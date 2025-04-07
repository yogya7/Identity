const express = require('express');
const mysql = require("mysql")
const path = require("path")
const dotenv = require('dotenv')
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const bodyParser = require('body-parser');
const fs = require("fs");
const os = require("os");

dotenv.config({ path: './.env'})

const app = express();

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})

const publicDir = path.join(__dirname, './public')

app.use(express.static(publicDir))
app.use(express.urlencoded({extended: 'false'}))
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true })); 

app.set('view engine', 'hbs')

db.connect((error) => {
    if(error) {
        console.log(error)
    } else {
        console.log("MySQL connected!")
    }
})

function setEnvValue(filename, key, value) {

    // read file from hdd & split if from a linebreak to a array
    const newFileName = './.'+filename;
    const ENV_VARS = fs.readFileSync(newFileName, "utf8").split(os.EOL);

    // find the env we want based on the key
    const target = ENV_VARS.indexOf(ENV_VARS.find((line) => {
        return line.match(new RegExp(key));
    }));

    // replace the key/value with the new value
    ENV_VARS.splice(target, 1, `${key}=${value}`);

    // write everything back to the file system
    fs.writeFileSync(newFileName, ENV_VARS.join(os.EOL));
    console.log("Record added to env file");
}

app.get("/", (req, res) => {
    res.render("index")
})

app.get("/source", (req, res) => {
    res.render("source")
})

app.get("/login", (req, res) => {
    res.render("login")
})

app.post("/auth/insertDestinationDetails", (req, res) => {
    const { company, oktaSubDomain, oktaAPIToken } = req.body;

    const dummyTableName = company+oktaSubDomain+"Credentials";
    setEnvValue("env2","DESTABLENAME", dummyTableName);

    const createTableQuery = 'CREATE TABLE IF NOT EXISTS '+dummyTableName+' ( CompanyName varchar(255), OKTASubDomain varchar(255), OKTAAPIToken varchar(255));'
    db.query(createTableQuery, async (error, result) => {
        if(error){
            console.log(error)
        }
        else
        {
            console.log("Table Created!");
            const deleteTableRecordQuery = 'DELETE FROM '+dummyTableName+';'
            const insertTableQuery = 'INSERT INTO '+dummyTableName+' (CompanyName, OKTASubDomain, OKTAAPIToken) VALUES ("'+ company +'", "'+oktaSubDomain+'", "'+oktaAPIToken+'");'
            console.log(insertTableQuery);
            db.query(deleteTableRecordQuery, (err, result) => {
                if(error) throw err;
                else
                {
                    console.log("Table record deleted");
                    db.query(insertTableQuery, (err, result) => {
                        if(error) throw err;
                        console.log("record Inserted"+result);
                        res.render("secondPhase");
                    });
                }  
            })  
        }   
    })
})

app.post("/auth/insertDBdetails", (req, res) => {    
    const { company, host, port, username, password, dbname, dbtable } = req.body

    const dummyTableName = company+dbname+"Credentials";
    setEnvValue("env1", "COMDATATABLENAME", dummyTableName);

    const createTableQuery = 'CREATE TABLE IF NOT EXISTS '+dummyTableName+' ( CompanyName varchar(255), Host varchar(255), Port varchar(255), Username varchar(255), Password varchar(255), DBName varchar(255), TableName varchar(255));'

    db.query(createTableQuery, async (error, result) => {
        if(error){
            console.log(error)
        }
        else
        {
            console.log("Table Created!");
            const deleteTableRecordQuery = 'DELETE FROM '+dummyTableName+';'
            const insertTableQuery = 'INSERT INTO '+dummyTableName+' (CompanyName, Host, Port, Username, Password, DBName, TableName) VALUES ("'+ company +'", "'+host+'", "'+port+'", "'+username+'", "'+password+'", "'+dbname+'", "'+dbtable+'");'
            console.log(insertTableQuery);
            db.query(deleteTableRecordQuery, (err, result) => {
                if(error) throw err;
                else
                {
                    console.log("Table record deleted");
                    db.query(insertTableQuery, (err, result) => {
                        if(error) throw err;
                        console.log("record Inserted"+result);
                        res.render("destination");
                    });
                }  
            })  
        }   
    })
})

app.post("/getSelected", (req, res) => {
    const sel = req.body.selectpicker;

    switch(sel) {
        case "1":
            res.render("adForm");
            break;
        case "2":
            res.render("ldapForm");
            break;
        case "3":
            res.render("dbForm");
            break;
        case "4":
            res.render("authForm");
            break;
        case "5":
            res.render("pingForm");
            break;
        case "6":
            res.render("oktaForm");
            break;
        default:
            res.render("index");
    }
})



app.listen(5000, ()=> {
    console.log("server started on port 5000")
})
