const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://medi-connect-vercel.app",
  "https://medi-connect-abftpueep-codemewith4-9288s-projects.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
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
