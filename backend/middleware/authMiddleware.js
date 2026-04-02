const jwt = require("jsonwebtoken");

const verifyToken = (req,res,next)=>{

    const header = req.headers["authorization"];

    if(!header || !header.startsWith("Bearer ")) return res.status(401).send("Invalid Token");

    const token = header.split(" ")[1];

    if(!token) return res.status(401).send("Invalid Token");

    jwt.verify(token,"secretkey",(err,decoded)=>{
    if(err) return res.status(401).send("Invalid Token");

        req.user = decoded;
        next();
    });
};

module.exports = verifyToken;
