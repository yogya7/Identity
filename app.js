const express = require('express');
const mysql = require("mysql")
const path = require("path")
const dotenv = require('dotenv')
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const bodyParser = require('body-parser');
const fs = require("fs");
const os = require("os");
const axios = require('axios');
const store = require('store');

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

    store.set('subDomain', { name: oktaSubDomain });
    store.set('apiToken', { name : oktaAPIToken });

    console.log(store.get('subDomain'));
    console.log(store.get('apiToken'));

    var index = oktaSubDomain.indexOf(".");
    let oktaSubDomain2 = oktaSubDomain.substring(0,index);
    let oktaSubDomain3 = oktaSubDomain2.replaceAll("-","");
    const dummyTableName = "Destination_Credentials";
    setEnvValue("env2","DESTABLENAME", dummyTableName);

    const createTableQuery = 'CREATE TABLE IF NOT EXISTS '+dummyTableName+' ( CompanyName varchar(255), OKTASubDomain varchar(255), OKTAAPIToken varchar(255));'
    db.query(createTableQuery, async (error, result) => {
        if(error){
            console.log(error)
        }
        else
        {
            console.log("Destination table has been created!");
            const deleteTableRecordQuery = 'DELETE FROM '+dummyTableName+';'
            const insertTableQuery = 'INSERT INTO '+dummyTableName+' (CompanyName, OKTASubDomain, OKTAAPIToken) VALUES ("'+ company +'", "'+oktaSubDomain+'", "'+oktaAPIToken+'");'
            console.log(insertTableQuery);
            db.query(deleteTableRecordQuery, (err, result) => {
                if(error) throw err;
                else
                {
                    console.log("Existing table records have bee deleted!");
                    db.query(insertTableQuery, (err, result) => {
                        if(error) throw err;
                        console.log("Destination credentials have been stored in database!");
                        res.render("secondPhase");
                    });
                }  
            })  
        }   
    })
})


app.post("/auth/replicateIdentities", (req, res) => {
    let data = '';
    let replicateResult = '';
    
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://oq5q83v42i.execute-api.us-east-1.amazonaws.com/sqldbdata',
        headers: { },
        data : data
    };
 
    axios.request(config)
        .then((response) => {
            replicateResult = JSON.stringify(response.data);
            console.log(replicateResult);
            let replicateResult2 = replicateResult.replaceAll('"','');
            if(replicateResult2 === 'Identities Replicated!')
            {
                res.render("migrateIdentities");
            }
        })
        .catch((error) => {
            console.log(error);
        });
})

app.post("/auth/migrateIdentities", (req, res) => {
    const axios = require('axios');

    let nextPage, nextPage2;

    let data = JSON.stringify({
        "OktaURL": store.get('subDomain').name,
        "Token": store.get('apiToken').name,
        "TableName": "User_Identity_Dummy"
    });
 
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://oq5q83v42i.execute-api.us-east-1.amazonaws.com/createuser/okta',
        headers: {
            'Content-Type': 'application/json'
        },
        data : data
    };
 
    axios.request(config)
        .then((response) => {
            console.log(JSON.stringify(response.data));
            nextPage = JSON.stringify(response.data);
            nextPage2 = nextPage.substring(1,7);
            console.log(nextPage2);
            if(nextPage2 === "UPDATE")
            {
                res.render("loader");
            }
        })
        .catch((error) => {
            console.log(error);
        });
})

app.get("/auth/getLogs", (req, res) => {
    const axios = require('axios');
    let data = JSON.stringify({
    "tableName": "User_Identity_Dummy"
    });
 
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://oq5q83v42i.execute-api.us-east-1.amazonaws.com/createuser/okta/logs',
        headers: { 
            'Content-Type': 'application/json'
        },
        data : data
    };
 
    axios.request(config)
        .then((response) => {

            const results = [response.data.success, response.data.failuer, response.data.totalUsers];
            console.log(JSON.stringify(response.data.success));
            console.log(JSON.stringify(response.data.failuer));
            console.log(JSON.stringify(response.data.totalUsers));
            const data1 = results;
            res.render('statusViewer', { code: data1 });
            return response;
        })
        .catch((error) => {
            console.log(error);
        });
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
            console.log("Source table has been created!");
            const deleteTableRecordQuery = 'DELETE FROM '+dummyTableName+';'
            const insertTableQuery = 'INSERT INTO '+dummyTableName+' (CompanyName, Host, Port, Username, Password, DBName, TableName) VALUES ("'+ company +'", "'+host+'", "'+port+'", "'+username+'", "'+password+'", "'+dbname+'", "'+dbtable+'");'
            console.log(insertTableQuery);
            db.query(deleteTableRecordQuery, (err, result) => {
                if(error) throw err;
                else
                {
                    console.log("Existing table record has been deleted!");
                    db.query(insertTableQuery, (err, result) => {
                        if(error) throw err;
                        console.log("Source credentials have been stored in database!");
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


app.listen(5001, ()=> {
    console.log("server started on port 5001")
})