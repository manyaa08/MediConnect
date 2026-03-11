# MediConnect – Surplus Medicine Redistribution System

MediConnect is a full-stack web application built to reduce medicine wastage by connecting people who have surplus medicines with NGOs that distribute medicines to those in need.

Many usable medicines are thrown away simply because people do not know where to donate them. At the same time, many communities struggle to access essential medicines. MediConnect attempts to bridge this gap by providing a simple platform where donors can list medicines and NGOs can request them.

---

## What the system does

The platform allows two types of users: **Donors** and **NGOs**.

### Donors can

* Add surplus medicines to the system
* Manage their medicine inventory
* Track which medicines have been requested

### NGOs can

* Browse available medicines
* Request medicines they need
* Track request status

The goal is to make redistribution of medicines **organized, transparent, and efficient**.

---

## Tech Stack

**Backend**

* Node.js
* Express.js
* MySQL (mysql2 library)

**Frontend**

* HTML
* CSS
* JavaScript

**Database**

* Relational database design (normalized schema)


## Project Structure

```
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
│   ├── donorDashboard
│   ├── ngoDashboard
│   ├── addMedicine
│   └── requestMedicine
│
└── package.json
```

The backend follows a modular structure with **routes, controllers, middleware, and database configuration**.

## Database Design

The system uses a relational database to manage:

* Users
* Medicines
* Medicine requests
* Donor inventory

The schema is normalized to reduce redundancy and ensure data consistency.

---

## Example Features Implemented

* Role-based login system
* Medicine inventory management
* Request tracking between donors and NGOs
* Donor and NGO dashboards
* REST API backend using Node.js

---

## Running the Project

1. Clone the repository

```
git clone https://github.com/manyaa08/MediConnect.git
```

2. Install dependencies

```
npm install
```

3. Configure database credentials in

```
backend/db.js
```

4. Run the server

```
node server.js
```

---

## Current Status

This project is currently **under development**, with the backend and database logic mostly implemented.

---

## Author

Manya Kedia
B.E. Computer Science and Engineering
Thapar Institute of Engineering and Technology
