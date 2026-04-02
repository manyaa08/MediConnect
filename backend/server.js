const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
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
