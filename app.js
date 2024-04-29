//importing modules

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


//creating express app

const app = express();

// mysql connection configuration

const connection = mysql.createConnection(
    {
        host:'localhost',
        user: 'root',
        password : '2301',
        database : 'customerdb'
    }
);

//connecting to mysql

connection.connect((err) => {
    if(err){
        console.log("Error",err);
        return;
    }
    console.log("connected to mysql db");
});

//middleware to parse JSON bodies
app.use(express.json());

//user registration api endpoint

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
       
        const hashedPassword = await bcrypt.hash(password, 10);
     
        connection.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (error, results, fields) => {
            if (error) {
                console.error('Error registering user:', error);
                res.status(500).json({ error: 'Error registering user' });
                return;
            }
            res.status(201).json({ message: 'User registered successfully' });
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Error registering user' });
    }
});

// User Login api endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        
        connection.query('SELECT * FROM users WHERE username = ?', username, async (error, results, fields) => {
            if (error) {
                console.error('Error logging in:', error);
                res.status(500).json({ error: 'Error logging in' });
                return;
            }
            if (results.length === 0) {
                res.status(401).json({ error: 'Invalid username or password' });
                return;
            }
            const user = results[0];
            // Compare passwords
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                res.status(401).json({ error: 'Invalid username or password' });
                return;
            }
            // Generate JWT token
            const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, 'secret_key', { expiresIn: '1h' });
            res.status(200).json({ token });
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

//function to verify jwt token
function verifyToken(req, res, next) {
    // const token = req.headers['authorization'];
    const token = req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token not provided' });
    }

    jwt.verify(token, 'secret_key', (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        req.userId = decoded.id;
        next();
    });
}


app.use(verifyToken);

//api to insert customer data

app.post('/customers',(req,res) =>{

    console.log("inside post api");

    const { name, email} = req.body;
    const customer = {name,email};

    connection.query('INSERT INTO customers SET ?',[customer], (error, results, fields) =>{
        if(error){
            console.error('Error adding customer ', error);
            res.status(500).json({error :"Error adding customer"});
            return;
        }
        res.status(201).json({message : 'Customers added sussessfully', customer_id:results.insertId});

    });
});

//api to retrieve customer details by ID
app.get('/customers/:id',(req, res) => {
    const customerId = req.params.id;

    
    connection.query('SELECT * FROM customers WHERE id = ?',[customerId], (error, results, fields) => {
        if (error) {
            console.error('Error retrieving customer details:', error);
            res.status(500).json({ error: 'Error retrieving customer details' });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        const customer = results[0];
        res.status(200).json(customer);
    });
});


// api to update existing customer information
app.put('/customers/:id',(req, res) => {
    const customerId = req.params.id;
    const { name, email } = req.body;
    const updatedCustomer = { name, email };

   
    connection.query('UPDATE customers SET ? WHERE id = ?',[updatedCustomer,customerId], (error, results, fields) => {
        if (error) {
            console.error('Error updating customer information:', error);
            res.status(500).json({ error: 'Error updating customer information' });
            return;
        }

        if (results.affectedRows === 0) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        res.status(200).json({ message: 'Customer information updated successfully' });
    });
});

//API to delete a customer from the database
app.delete('/customers/:id',(req, res) => {
    const customerId = req.params.id;

    connection.query('DELETE FROM customers WHERE id = ?',[customerId], (error, results, fields) => {
        if (error) {
            console.error('Error deleting customer:', error);
            res.status(500).json({ error: 'Error deleting customer' });
            return;
        }

        if (results.affectedRows === 0) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        res.status(200).json({ message: 'Customer deleted successfully' });
    });
});

//filter api 

app.get('/customers', (req, res) => {
    const { name, email, sortBy, sortOrder, page, pageSize } = req.query;

    let query = 'SELECT * FROM customers WHERE 1=1';
    let queryParams = [];

    // Add filters
    if (name) {
        query += ' AND name LIKE ?';
        queryParams.push(`%${name}%`);
    }
    if (email) {
        query += ' AND email LIKE ?';
        queryParams.push(`%${email}%`);
    }

    // Add sorting
    if (sortBy && ['name', 'email'].includes(sortBy)) {
        query += ` ORDER BY ${sortBy}`;
        if (sortOrder && sortOrder.toLowerCase() === 'desc') {
            query += ' DESC';
        } else {
            query += ' ASC';
        }
    }

    // Add pagination
    if (page && pageSize) {
        const offset = (page - 1) * pageSize;
        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(pageSize), offset);
    }

    connection.query(query, queryParams, (error, results, fields) => {
        if (error) {
            console.error('Error fetching customers:', error);
            res.status(500).json({ error: 'Error fetching customers' });
            return;
        }
        res.status(200).json({ customers: results });
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
