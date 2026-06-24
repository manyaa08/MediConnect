const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://mediconnect24.vercel.app",
  "https://mediconnect-git-main-codemewith4-9288s-projects.vercel.app",
  "https://mediconnect-2eqfh5vhd-codemewith4-9288s-projects.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("Request Origin:", origin);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("BLOCKED ORIGIN:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());

app.get("/", (req,res)=>{
    res.send("Mediconnect Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>{
  console.log(`Server running on port ${PORT}`);
});

const userRoutes = require("./routes/userRoutes");
app.use("/users", userRoutes);

const medicineRoutes = require("./routes/medicineRoutes");
app.use("/medicines", medicineRoutes);

const requestRoutes = require("./routes/requestRoutes");
app.use("/requests", requestRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/dashboard", dashboardRoutes);

const transferRoutes = require("./routes/transferRoutes");
app.use("/transfers", transferRoutes);

const adminRoutes = require("./routes/adminRoutes");
app.use("/admin", adminRoutes);
