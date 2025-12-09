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

      const result = await requestsCollection.insertOne(requestData);
      res.send(result);
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
