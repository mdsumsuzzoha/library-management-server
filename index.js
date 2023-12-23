const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware 
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@pheroprojectdbcluster.qyoezfv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const booksCollection = client.db('bookLibraryDB').collection('books');
        const borrowCollection = client.db('bookLibraryDB').collection('borrowed');

        app.post('/borrowed', async (req, res) => {
            const borrow = req.body;
            console.log(borrow);
            const result = await borrowCollection.insertOne(borrow);
            res.send(result);

        })

        app.get('/books', async (req, res) => {
            const cursor = booksCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/booksByCat', async (req, res) => {
            // console.log(req.query.category);
            const query = { category: req.query.category };
            const options = {
                sort: { name: 1 },
            };
            const result = await booksCollection.find(query, options).toArray();
            res.send(result);
        })
        app.get('/books/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await booksCollection.findOne(query);
            res.send(result);

        })
        // get info from db borroewd books by user
        app.get('/borrowed', async (req, res) => {
            const cursor = borrowCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.patch('/books/:id', async (req, res) => {
            console.log(req.body);
            const id = req.body.id
            const query = { _id: new ObjectId(id) };
            const update = { $inc: { qty: -1 } };
            const options = { returnOriginal: false };
            const result = await booksCollection.findOneAndUpdate(query, update, options);
            console.log(result);
            
            res.send(result);

        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Library management server running')
})
app.listen(port, () => {
    console.log(`Library management server running on port: ${port}`)
})