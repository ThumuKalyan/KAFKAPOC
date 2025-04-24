# Kafka Project with MySQL Database

This project utilizes:
- **Apache Kafka** (`kafka_2.12-3.9.0`)
- **Java** (JDK required)
- **Node.js & NPM**
- **MySQL** (Database)

## Prerequisites

Ensure the following are installed on your Windows machine:
1. **Java Development Kit (JDK)**  
   - Apache Kafka is written in Java, so you need JDK installed. You can download the latest version from the [Oracle website](https://www.oracle.com/java/) or adopt OpenJDK.

2. **Node.js & NPM**  
   - Required for handling Node dependencies. Install the latest version from [Node.js official website](https://nodejs.org/).

3. **Kafka Installation**  
   - Follow this guide to properly install Kafka:  
   [How to Install Kafka on Windows](https://medium.com/@minhlenguyen02/how-to-properly-install-kafka-on-windows-11-a-step-by-step-guide-7b510dd78d05).

4. **MySQL Database**  
   - Download and install MySQL from [MySQL official website](https://dev.mysql.com/downloads/installer/).
   - Set up a new database:
     ```sql
     CREATE DATABASE kafka_project;
     ```
   - Configure MySQL connection settings in your application.

## Setup & Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/ThumuKalyan/KAFKAPOC.git
cd KAFKAPOC
```

### Step 2: Install Dependencies
npm install

### Step 3: Start Kafka
# Start Zookeeper
``` bin/windows/zookeeper-server-start.bat config/zookeeper.properties ```

# Start Kafka Server
``` bin/windows/kafka-server-start.bat config/server.properties ```

### Step 4: Set Up MySQL Database Connection
``` const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'kafka_project'
}); ```

### Step 5: Run Your Application
Make Sure you run all three applications are running use npm start 
