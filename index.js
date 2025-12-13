require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");

const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const upload = multer({ storage: multer.memoryStorage() });

const stripe = require("stripe")(process.env.STRIPE_SECRET);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// firebase admin

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
    const paymentsCollection = db.collection("payments");
    const packagesCollection = db.collection("packages");
    const requestsCollection = db.collection("requests");
    const assignedAssetsCollection = db.collection("assignedAssets");
    const employeeAffiliationsCollections = db.collection("affiliation");

    // MiDDLEWARE route

    const verifyJWTToken = (req, res, next) => {
      const authorization = req.headers.authorization;

      if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const token = authorization.split(" ")[1];

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }

        req.decoded = decoded;
        req.token_email = decoded.email;

        next();
      });
    };
    const verifyOwner = (req, res, next) => {
      const email = req.query.email || req.params.email || req.body.email;

      if (email && email !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyHR = async (req, res, next) => {
      const email = req.token_email;
      const user = await userCollection.findOne({ email });
      if (user.role?.toLowerCase() !== "hr") {
        return res.status(403).send({ message: "HR only access" });
      }
      next();
    };

    const verifyEmployee = async (req, res, next) => {
      const email = req.token_email;
      const user = await userCollection.findOne({ email });
      if (!user || user.role !== "Employee") {
        return res.status(403).send({ message: "Employee only access" });
      }
      next();
    };

    // JWT related apis
    app.post("/getToken", async (req, res) => {
      const { email } = req.body;

      const user = await userCollection.findOne({ email });
      if (!user) {
        return res.status(401).send({ message: "unauthorized" });
      }

      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //     user related api
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
        user.position = "not assigned";
      }

      const result = await userCollection.insertOne(user);
      res.send({ inserted: true, result });
    });

    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      res.send({ role: user?.role || "guest" });
    });

    app.get("/user/:email", verifyJWTToken, verifyOwner, async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.findOne({ email });
      res.send(result || {});
    });

    // assets related apis
    app.post(
      "/asset",
      verifyJWTToken,
      verifyHR,
      upload.single("image"),
      async (req, res) => {
        try {
          if (!req.file) {
            return res.status(400).send({ message: "Image file is required" });
          }

          const formData = new FormData();
          formData.append("image", req.file.buffer.toString("base64"));

          const imgRes = await axios.post(
            `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_KEY}`,
            formData,
            { headers: formData.getHeaders() }
          );

          const imageURL = imgRes.data.data.url;

          const assetAutoData = {
            productName: req.body.productName,
            productImage: imageURL,
            productType: req.body.productType,
            productQuantity: Number(req.body.productQuantity),
            availableQuantity: Number(req.body.productQuantity),
            hrEmail: req.token_email,
            companyName: req.body.companyName || "Unknown",
            dateAdded: new Date(),
          };

          const result = await assetCollection.insertOne(assetAutoData);

          res.send({ success: true, insertedId: result.insertedId });
        } catch (err) {
          console.error("Asset upload error:", err);
          res.status(500).send({ message: "Image upload failed" });
        }
      }
    );

    app.get("/asset", verifyJWTToken, verifyHR, async (req, res) => {
      const hrEmail = req.token_email;

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const skip = (page - 1) * limit;

      const total = await assetCollection.countDocuments({ hrEmail });

      const assets = await assetCollection
        .find({ hrEmail })
        .skip(skip)
        .limit(limit)
        .sort({ dateAdded: -1 })
        .toArray();

      res.send({
        data: assets,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
    });

    app.delete("/asset/:id", verifyJWTToken, verifyHR, async (req, res) => {
      const id = req.params.id;

      const asset = await assetCollection.findOne({ _id: new ObjectId(id) });

      if (!asset) {
        return res.status(404).send({ message: "Asset not found" });
      }

      if (asset.hrEmail !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const result = await assetCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // employees requests  apis

    app.post("/request", verifyJWTToken, verifyEmployee, async (req, res) => {
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

    app.get("/request", verifyJWTToken, verifyHR, async (req, res) => {
      const hrEmail = req.token_email;
      const result = await requestsCollection
        .find({ hrEmail })
        .sort({ requestDate: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });

    app.patch(
      "/request/approve/:id",
      verifyJWTToken,
      verifyHR,
      async (req, res) => {
        const hrInformation = req.body;
        const id = req.params.id;

        const request = await requestsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (request.hrEmail !== req.token_email) {
          return res.status(403).send({ message: "forbidden access" });
        }

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
        const alreadyAffiliated = await employeeAffiliationsCollections.findOne(
          {
            employeeEmail: request.requesterEmail,
            hrEmail: request.hrEmail,
          }
        );
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
          // console.log(alreadyAffiliated);
        }
        res.send({
          modifiedCount: updated.modifiedCount,
          message: "Request Approved Successfully",
        });
      }
    );

    app.patch(
      "/request/reject/:id",
      verifyJWTToken,
      verifyHR,
      async (req, res) => {
        const id = req.params.id;
        const request = await requestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (request.hrEmail !== req.token_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
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
      }
    );

    // employee assets apis--------------------------------------------
    app.get(
      "/my-asset",
      verifyJWTToken,
      verifyEmployee,
      verifyOwner,
      async (req, res) => {
        const email = req.query.email;

        let query = {};
        if (email) {
          query = { employeeEmail: email };
        }

        const result = await assignedAssetsCollection
          .find(query)
          .sort({ assignmentDate: -1 })
          .toArray();

        res.send(result);
      }
    );

    app.get(
      "/assets/employee",
      verifyJWTToken,
      verifyEmployee,
      async (req, res) => {
        const assets = await assetCollection
          .find({ availableQuantity: { $gt: 0 } })
          .sort({ dateAdded: -1 })
          .toArray();

        res.send(assets);
      }
    );

    app.patch(
      "/asset/return/:id",
      verifyJWTToken,
      verifyEmployee,
      async (req, res) => {
        const id = req.params.id;

        const assignedAsset = await assignedAssetsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (assignedAsset.employeeEmail !== req.token_email) {
          return res.status(403).send({ message: "forbidden access" });
        }

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
      }
    );

    app.get("/employees", verifyJWTToken, verifyHR, async (req, res) => {
      const hrEmail = req.token_email;
      const employees = await employeeAffiliationsCollections
        .find({ hrEmail, status: "active" })
        .sort({ affiliationDate: -1 })
        .toArray();

      const finalData = await Promise.all(
        employees.map(async (emp) => {
          const user = await userCollection.findOne({
            email: emp.employeeEmail,
          });
          // console.log(emp);

          const assetsCount = await assignedAssetsCollection.countDocuments({
            employeeEmail: emp.employeeEmail,
          });

          return {
            _id: emp._id,
            name: emp.employeeName || user?.displayName,
            email: emp.employeeEmail,
            photo: user?.image || null,
            joinDate: emp.affiliationDate,
            assetsCount,
            companyName: emp.companyName,
          };
        })
      );

      res.send(finalData);
    });

    app.get("/employees/stats", verifyJWTToken, verifyHR, async (req, res) => {
      const hrEmail = req.token_email;

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

    app.patch(
      "/employees/remove/:id",
      verifyJWTToken,
      verifyHR,
      async (req, res) => {
        const id = req.params.id;

        const employee = await employeeAffiliationsCollections.findOne({
          _id: new ObjectId(id),
        });
        if (employee.hrEmail !== req.token_email) {
          return res.status(403).send({ message: "forbidden access" });
        }

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
      }
    );

    app.get(
      "/myTeam/companies",
      verifyJWTToken,
      verifyEmployee,
      verifyOwner,
      async (req, res) => {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Employee email is required",
          });
        }

        const affiliations = await employeeAffiliationsCollections
          .find({ employeeEmail: email, status: "active" })
          .toArray();

        if (!affiliations.length) {
          return res.send([]);
        }

        const companyNames = [
          ...new Set(affiliations.map((a) => a.companyName)),
        ];

        res.send(companyNames);
      }
    );

    app.get(
      "/myTeam/list",
      verifyJWTToken,
      verifyEmployee,
      verifyOwner,
      async (req, res) => {
        const email = req.query.email;

        const loggedUser = await userCollection.findOne({ email });
        // console.log(loggedUser)
        if (!loggedUser) {
          return res.send([]);
        }

        const affiliations = await employeeAffiliationsCollections
          .find({ employeeEmail: email, status: "active" })
          .toArray();

        if (affiliations.length === 0) {
          return res.send([]);
        }

        const companies = affiliations.map((a) => a.companyName);

        const teamMembers = await employeeAffiliationsCollections
          .find({
            companyName: { $in: companies },
            status: "active",
          })
          .toArray();

        const finalTeamData = await Promise.all(
          teamMembers.map(async (emp) => {
            const userData = await userCollection.findOne({
              email: emp.employeeEmail,
            });

            return {
              _id: emp._id,
              name: userData?.name || emp.employeeName,
              email: emp.employeeEmail,
              photo: userData?.image || null,
              position: userData?.position || "Employee",
              dob: userData?.dob || null,
              joinDate: emp.affiliationDate,
              companyName: emp.companyName,
            };
          })
        );
        // console.log(finalTeamData);
        res.send(finalTeamData);
      }
    );
    // packages collection
    app.post("/add-packages", async (req, res) => {
      const defaultPackages = [
        {
          name: "Basic",
          employeeLimit: 5,
          price: 5,
          features: ["Asset Tracking", "Employee Management", "Basic Support"],
        },
        {
          name: "Standard",
          employeeLimit: 10,
          price: 12,
          features: [
            "All Basic features",
            "Team Collaboration",
            "Company Branding",
          ],
        },
        {
          name: "Premium",
          employeeLimit: 20,
          price: 20,
          features: [
            "All Standard features",
            "Advanced Reporting",
            "Priority Support",
          ],
        },
      ];

      const result = await packagesCollection.insertMany(defaultPackages);
      res.send(result);
    });

    app.get("/packages", async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });

    // payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const { price, packageName, employeeLimit, email } = req.body;

      const amount = Math.round(price * 100);

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          mode: "payment",

          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: packageName },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],

          customer_email: email,

          metadata: {
            packageName,
            employeeLimit: employeeLimit.toString(),
          },

          success_url: `${process.env.SITE_DOMAIN}/payment/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment/payment-cancel`,
        },
        {
          idempotencyKey: `${email}-${packageName}-${Date.now()}`,
        }
      );

      if (!session.url) {
        return res.status(500).send({ error: "Stripe did not return a URL" });
      }

      res.send({ url: session.url });
    });

    app.get("/verify-session", verifyJWTToken, async (req, res) => {
      const sessionId = req.query.session_id;

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.customer_email !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      if (session.payment_status !== "paid") {
        return res.send({ success: false });
      }

      const user = await userCollection.findOne({
        email: session.customer_email,
      });

      const oldLimit = user.packageLimit || 0;
      const newLimit = Number(session.metadata.employeeLimit);

      const updatedLimit = oldLimit + newLimit;

      // Save Payment
      await paymentsCollection.insertOne({
        hrEmail: session.customer_email,
        packageName: session.metadata.packageName,
        employeeLimit: newLimit,
        amount: session.amount_total / 100,
        transactionId: session.payment_intent,
        paymentDate: new Date(),
        status: "completed",
      });

      // Update User
      await userCollection.updateOne(
        { email: session.customer_email },
        {
          $set: {
            subscription: session.metadata.packageName,
            packageLimit: updatedLimit,
          },
        }
      );

      res.send({ success: true });
    });

    // user update apis

    app.patch(
      "/user/update/:email",
      verifyJWTToken,
      verifyOwner,
      async (req, res) => {
        const updateData = req.body;

        await userCollection.updateOne(
          { email: req.params.email },
          { $set: updateData }
        );

        res.send({ success: true });
      }
    );

    // rechart
    app.get(
      "/analytics/asset-types",
      verifyJWTToken,
      verifyHR,
      async (req, res) => {
        const assets = await assetCollection.find().toArray();

        let returnable = 0;
        let nonReturnable = 0;

        assets.forEach((asset) => {
          if (asset.productType === "Returnable") {
            returnable++;
          } else {
            nonReturnable++;
          }
        });

        res.send([
          { name: "Returnable", value: returnable },
          { name: "Non-returnable", value: nonReturnable },
        ]);
      }
    );

    app.get(
      "/analytics/top-requested",
      verifyJWTToken,
      verifyHR,
      async (req, res) => {
        const requests = await requestsCollection.find().toArray();

        const countMap = {};

        requests.forEach((req) => {
          countMap[req.assetName] = (countMap[req.assetName] || 0) + 1;
        });

        const result = Object.entries(countMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        res.send(result);
      }
    );

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
