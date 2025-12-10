require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(express.json());
app.use(cors());

// mongodb ui
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.phhktud.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("GearGuard server is running");
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // collections
    const db = client.db("Gear_Guard_db");
    const userCollection = db.collection("users");
    const assetCollection = db.collection("assets");
    const requestsCollection = db.collection("requests");
    const assignedAssetsCollection = db.collection("assignedAssets");
    const employeeAffiliationsCollections = db.collection("affiliation");

    //     user related apis
    app.post("/users", async (req, res) => {
      const user = req.body;

      const exists = await userCollection.findOne({ email: user.email });
      if (exists) {
        return res.send({ message: "User already exists", inserted: false });
      }
      user.createdAt = new Date();

      //  HR
      if (user.role === "Hr") {
        user.packageLimit = 5;
        user.currentEmployees = 0;
        user.subscription = "basic";
      }

      //  EMPLOYEE
      if (user.role === "Employee") {
        user.status = "pending";
        user.companyId = null;
        user.position = "not assigned";
      }

      // Save to DB
      const result = await userCollection.insertOne(user);
      res.send({ inserted: true, result });
    });

    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      res.send({ role: user?.role || "guest" });
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result || {});
    });

    // assets related apis
    app.post("/asset", async (req, res) => {
      const asset = req.body;

      const assetAutoData = {
        productName: asset.productName,
        productImage: asset.productImage,
        productType: asset.productType,
        productQuantity: Number(asset.productQuantity),
        availableQuantity: Number(asset.productQuantity),
        hrEmail: asset.hrEmail,
        companyName: asset.companyName || "Unknown",
        dateAdded: new Date(),
      };
      const result = await assetCollection.insertOne(assetAutoData);
      res.send({ success: true, insertedId: result.insertedId });
    });

    app.get("/asset", async (req, res) => {
      const result = await assetCollection
        .find()
        .sort({ dateAdded: -1 })
        .toArray();
      res.send(result);
    });

    app.delete("/asset/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });

    // employees requests  apis

    app.post("/request", async (req, res) => {
      const requestData = req.body;
      requestData.requestDate = new Date();
      requestData.requestStatus = "pending";

      const alreadyRequested = await requestsCollection.findOne({
        requesterEmail: requestData.requesterEmail,
        assetId: requestData.assetId,
      });

      if (alreadyRequested) {
        return res.send({
          success: false,
          message: "You already requested this asset.",
        });
      }

      const result = await requestsCollection.insertOne(requestData);

      return res.send({
        success: true,
        message: "Request submitted successfully",
        insertedId: result.insertedId,
      });
    });

    app.get("/request", async (req, res) => {
      const hrEmail = req.query.hrEmail;
      const result = await requestsCollection
        .find({ hrEmail })
        .sort({ requestDate: -1 })
        .toArray();
      res.send(result);
    });

    app.patch("/request/approve/:id", async (req, res) => {
      const hrInformation = req.body;
      const id = req.params.id;

      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });

      const updated = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            requestStatus: "approved",
            approvalDate: new Date(),
            processedBy: request.hrEmail,
          },
        }
      );

      await assetCollection.updateOne(
        { _id: new ObjectId(request.assetId) },
        { $inc: { availableQuantity: -1 } }
      );

      // const alreadyAssigned = await assignedAssetsCollection.findOne({
      //   assetId: request.requesterEmail,
      // });

      // if (!alreadyAssigned) {
      await assignedAssetsCollection.insertOne({
        assetId: request.assetId,
        assetName: request.assetName,
        assetImage: request.assetImage,
        assetType: request.assetType,
        employeeEmail: request.requesterEmail,
        employeeName: request.requesterName,
        hrEmail: request.hrEmail,
        companyName: request.companyName,
        assignmentDate: new Date(),
        requestDate: request.requestDate,
        returnDate: null,
        status: "assigned",
      });
      // }

      // Affiliations
      const alreadyAffiliated = await employeeAffiliationsCollections.findOne({
        employeeEmail: request.requesterEmail,
        hrEmail: request.hrEmail,
      });
      if (!alreadyAffiliated) {
        await employeeAffiliationsCollections.insertOne({
          employeeEmail: request.requesterEmail,
          employeeName: request.requesterName,
          hrEmail: request.hrEmail,
          companyName: request.companyName,
          // companyLogo: request.hrInformation,
          companyLogo: hrInformation.companyLogo,
          affiliationDate: new Date(),
          status: "active",
        });
        console.log(alreadyAffiliated);
      }
      res.send({
        modifiedCount: updated.modifiedCount,
        message: "Request Approved Successfully",
      });
    });

    app.patch("/request/reject/:id", async (req, res) => {
      const id = req.params.id;
      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });
      const updated = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            requestStatus: "rejected",
            approvalDate: new Date(),
            processedBy: request.hrEmail,
          },
        }
      );
      res.send(updated);
    });

    // employee assets apis
    app.get("/myAssets", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }
      const result = await assignedAssetsCollection
        .find({ employeeEmail: email })
        .sort({ assignmentDate: -1 })
        .toArray();
      res.send(result);
    });

    app.patch("/asset/return/:id", async (req, res) => {
      const id = req.params.id;

      const assignedAsset = await assignedAssetsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!assignedAsset) {
        return res.send({ success: false, message: "Asset not found" });
      }

      await assignedAssetsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "returned",
            returnDate: new Date(),
          },
        }
      );

      await assetCollection.updateOne(
        { _id: new ObjectId(assignedAsset.assetId) },
        { $inc: { availableQuantity: 1 } }
      );

      res.send({ success: true, message: "Asset returned successfully" });
    });

    app.get("/employees", async (req, res) => {
      const hrEmail = req.query.hrEmail;

      // 1. Affiliation data → সব employee list
      const employees = await employeeAffiliationsCollections
        .find({ hrEmail, status: "active" })
        .sort({ affiliationDate: -1 })
        .toArray();

      // 2. Loop each employee to attach photo + assets count
      const finalData = await Promise.all(
        employees.map(async (emp) => {
          const user = await userCollection.findOne({
            email: emp.employeeEmail,
          });
          // console.log(user);

          const assetsCount = await assignedAssetsCollection.countDocuments({
            employeeEmail: emp.employeeEmail,
          });

          return {
            _id: emp._id,
            name: emp.employeeName || user?.displayName,
            email: emp.employeeEmail,
            photo: user?.image || "https://i.ibb.co/5xVqcD1/user.png",
            joinDate: emp.affiliationDate,
            assetsCount,
            companyName: emp.companyName,
          };
        })
      );

      res.send(finalData);
    });

    app.get("/employees/stats", async (req, res) => {
      const hrEmail = req.query.hrEmail;

      const hrData = await userCollection.findOne({
        email: hrEmail,
      });

      const totalEmployees =
        await employeeAffiliationsCollections.countDocuments({
          hrEmail,
          status: "active",
        });
      // console.log(hrData, totalEmployees, "total console.log");
      res.send({
        used: totalEmployees,
        limit: hrData?.packageLimit || 0,
      });
    });

    app.patch("/employees/remove/:id", async (req, res) => {
      const id = req.params.id;

      const employee = await employeeAffiliationsCollections.findOne({
        _id: new ObjectId(id),
      });

      if (!employee) {
        return res.send({ success: false, message: "Employee not found" });
      }

      await employeeAffiliationsCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "removed", removedDate: new Date() } }
      );

      await assignedAssetsCollection.updateMany(
        { employeeEmail: employee.employeeEmail, status: "assigned" },
        {
          $set: {
            status: "returned",
            returnDate: new Date(),
          },
        }
      );

      await assetCollection.updateMany(
        { hrEmail: employee.hrEmail },
        { $inc: { availableQuantity: 1 } }
      );

      res.send({ success: true, message: "Employee removed successfully" });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
