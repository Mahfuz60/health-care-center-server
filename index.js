const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const Port = process.env.PORT || 5000;
const admin = require("firebase-admin");
const app = express();
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0uftv.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//middleware
app.use(express.json());
app.use(cors());

//firebase admin setup

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const serviceAccount = require("./health-care-center-adminsdk.json");
// console.log(serviceAccount);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//verify token function admin panel
async function verifyIdToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers?.authorization?.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
}

//basic setup router
app.get("/", (req, res) => {
  res.send("Hello Health care center ");
});
async function run() {
  try {
    await client.connect();
    const database = client.db("health-care");
    // const usersCollection = database.collection("users");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");

    //GET api Appointments
    app.get("/appointments", verifyIdToken, async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      const query = { email: email, date: date };

      const cursor = appointmentCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    //POST API Appointments
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result);
    });

    //POST APi to save user in database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      // console.log(result);
      res.json(result);
    });

    //sign in user upsert to PUT(update) API
    app.put("/users", async (req, res) => {
      const user = req.body;
      // console.log("put",user);
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });
    //User Make an Admin API(update(PUT))
    app.put("/users/admin", verifyIdToken, async (req, res) => {
      const user = req.body;
      // console.log('decodedEmail',req.decodedEmail)
      const requestEmail = req.decodedEmail;
      if (requestEmail) {
        const requestAccount = await usersCollection.findOne({ email: requestEmail });
        if (requestAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: { role: "admin" },
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        } else {
          res.status(403).json({ message: "You  do not have this access role " });
        }
      }

      // console.log(result);
    });

    //GET API (make sure user login and admin role)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(Port, () => {
  console.log(`listening on port:${Port}`);
});
