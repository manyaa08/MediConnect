# MediConnect – Surplus Medicine Redistribution System

MediConnect is a web platform designed to reduce medicine wastage by connecting people who have surplus medicines with NGOs that distribute medicines to those in need.

Many usable medicines are discarded simply because individuals do not know where to donate them. At the same time, many communities struggle to access essential medicines. MediConnect aims to bridge this gap by providing a simple digital platform where donors can list surplus medicines and NGOs can request them.

---

## Features

The platform supports two types of users.

### Donors
- Add surplus medicines
- Manage medicine inventory
- Track medicine requests

### NGOs
- Browse available medicines
- Request medicines
- Track request status

---

## Tech Stack

Backend  
- Node.js  
- Express.js  
- MySQL (mysql2 library)

Frontend  
- HTML  
- CSS  
- JavaScript

Database  
- Relational database design

---

## Project Structure

medi-connect  
│  
├── backend  
│   ├── controllers  
│   ├── routes  
│   ├── middleware  
│   ├── db.js  
│   └── server.js  
│  
├── frontend  
│  
└── package.json  

The backend follows a modular architecture using routes, controllers, middleware, and a database connection layer.

---

## Database

The system uses a relational database to manage:

- Users  
- Medicines  
- Medicine requests  
- Donor inventory  

The schema is designed to reduce redundancy and maintain data consistency.

---

## Running the Project

Clone the repository

git clone https://github.com/manyaa08/MediConnect.git

Install dependencies

npm install

Configure database credentials in

backend/db.js

Run the server

node server.js

---

## Current Status

This project is currently under development.  
The backend APIs and database logic are implemented, while the frontend is still being developed.

---

## Author

Manya Kedia  
B.E. Computer Science and Engineering  
Thapar Institute of Engineering and Technology
