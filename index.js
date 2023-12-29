const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;



// Middleware 
const corsConfig = {
    origin: [
        // 'http://localhost:5173',
        //  other allowed origins here
        'https://library-management-d414f.web.app',
        'https://library-management-d414f.firebaseapp.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}
app.use(cors(corsConfig))
app.options("", cors(corsConfig))

// app.use(cors({
//     origin: [
//         // 'http://localhost:5173',
//         //  other allowed origins here
//         'https://library-management-d414f.firebaseapp.com',
//         'https://library-management-d414f.web.app',
//     ],
//     credentials: true,
// }));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@pheroprojectdbcluster.qyoezfv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    // connection pool for vercel
    // ==========================
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    // ==========================
});


// middleware


const verifyToken = async (req, res, next) => {
    // console.log(req.cookies);
    const token = req.cookies?.token;
    // console.log(token);
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized user' })
    }
    jwt.verify(token, process.env.ACCESS_TOCKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        // console.log('inside of if valid', decoded)
        // console.log('inside of if valid', decoded.email)
        req.user = decoded;
        next();
    })

}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // connection pool for vercel
        // ==========================
        client.connect((err) => {
            if (err) {
                // console.error(err);
                return;
            }
        });
        // ==========================


        const booksCollection = client.db('bookLibraryDB').collection('books');
        const borrowCollection = client.db('bookLibraryDB').collection('borrowed');


        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user,
                process.env.ACCESS_TOCKEN_SECRET,
                { expiresIn: '1h' }
            );
            res.cookie('token', token, {
                // maxAge: 900000,
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                // secure: false,
                // sameSite: 'strict',
            }).send('Token cookie set successfully');

        });

        app.get('/logout', (req, res) => {
            res.clearCookie('token').send('Logged out successfully')
        });

        // service related api
        app.post('/addBook', verifyToken, async (req, res) => {
            try {
                const bookInfo = req.body;
                const adminEmail = 'abc_librarian@email.com';
                if (adminEmail === req.user.email) {
                    const result = await booksCollection.insertOne(bookInfo);
                    res.send(result);
                } else if (req.query?.email == req.user.email) {
                    return res.status(403).send(
                        // { message: 'Forbidden access' }
                    );
                }
                return;
            } catch (error) {
                return res.send(error);
            }
        });

        app.post('/borrowed', verifyToken, async (req, res) => {
            try {
                const borrow = req.body;
                if (!req.user.email) {
                    return res.status(403).send({ message: 'Forbidden access' });
                } else {
                    const result = await borrowCollection.insertOne(borrow);
                    res.send(result);
                }
            } catch (error) {
                return res.send(error);
            }

        })


        app.get('/allBooks/:filterBy', verifyToken, async (req, res) => {
            try {
                // const userEmail = req.user.email;
                // console.log(userEmail)
                const filter = req.params?.filterBy;
                // console.log(filter);
                const qtyGTzero = { qty: { $gt: 0 } };
                const qtyLTzero = { qty: { $lt: 1 } };

                const adminEmail = 'abc_librarian@email.com';
                if (adminEmail === req.user.email) {
                    let result;
                    if (filter === 'avail') {
                        result = await booksCollection.find(qtyGTzero).toArray();
                    } else if (filter === 'na') {
                        result = await booksCollection.find(qtyLTzero).toArray();
                    } else {
                        result = await booksCollection.find().toArray();
                    }
                    res.send(result);
                } else {
                    return res.status(403).send(
                    );
                }
            } catch (error) {
                return res.send(error);
            }
        });

        // get the book bycategory to show in booksByCat.jsx through useEffect
        app.get('/booksByCat', async (req, res) => {
            try {
                const query = { category: req.query?.category };
                const options = {
                    sort: { name: 1 },
                };
                const result = await booksCollection.find(query, options).toArray();
                res.send(result);

            } catch (error) {
                return res.send(error);
            }
        });

        app.get('/bookDetails/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const user = req.user.email;
                if (user) {
                    const result = await booksCollection.findOne(query);
                    res.send(result);
                } else {
                    return res.status(401).send({ message: 'Login First' });
                }
            } catch (error) {
                // console.error('Error in fetching book by ID:', error);
                return res.send(error);
            }
        });

        // get info from db borroewd books by specific user
        app.get('/borrowed', verifyToken, async (req, res) => {
            try {
                const query = { email: req.query.email };

                const options = {
                    sort: { returnDate: 1 },
                };

                if (req.query.email !== req.user.email) {
                    return res.status(403).send({ message: 'Forbidden access' });
                } else {
                    const result = await borrowCollection.find(query, options).toArray();
                    res.send(result);
                }
            } catch (error) {
                return res.send(error);
            }
        });

        // to decrease qty of book to when submit Borrow
        app.patch('/booksQtyDec/:_id', verifyToken, async (req, res) => {
            try {
                const id = req.params._id;
                // console.log("Received ID:", id);
                const userEmail = req.user.email;
                // console.log("Received ID:", userEmail);
                const query = { _id: new ObjectId(id) };
                // console.log("Query:", query);

                const updateDoc = {
                    $inc: {
                        qty: -1 // Decrementing the qty field by 1
                    }
                };
                // console.log("Update Document:", updateDoc);

                const options = { upsert: false };

                if (userEmail) {
                    const result = await booksCollection.updateOne(query, updateDoc, options);
                    // console.log("Update Result:", result);
                    res.send(result);

                }
            } catch (error) {
                // console.error("Error:", error);
                res.status(500).send('Internal server error');
            }
        });

        // to increase qty of book to borrow
        app.patch('/booksQtyInc/:_id', verifyToken, async (req, res) => {
            try {

                const bookId = req.params._id;
                const query = { _id: new ObjectId(bookId) };
                const userEmail = req.user.email;

                const updateDoc = { $inc: { qty: 1 } };
                const options = { upsert: false };
                if (userEmail) {
                    const result = await booksCollection.updateOne(query, updateDoc, options);
                    // console.log("Update Result:", result);
                    res.send(result);

                }
            } catch (error) {
                return res.send(error);
            }
        });

        app.patch('/updateBookDetails/:id', verifyToken, async (req, res) => {
            try {
                const _id = req.params.id;
                // console.log('Received ID:', _id);
                const updateBook = req.body;
                // console.log('Received Update Data:', updateBook);

                const query = { _id: new ObjectId(_id) };
                const options = { upsert: true };
                const updateDoc = {
                    $set: {
                        // Update fields based on your requirements
                        name: updateBook.name,
                        author: updateBook.author,
                        category: updateBook.category,
                        img: updateBook.img,
                        description: updateBook.description,
                        qty: updateBook.qty, // Assuming qty is a number
                        rating: updateBook.rating, // Assuming rating is a floating-point number
                        ISBN: updateBook.ISBN,
                        pages: updateBook.pages,
                        publisher: updateBook.publisher,
                        publishedYear: updateBook.publishedYear,
                        language: updateBook.language
                        // Add other fields as needed
                    },
                };
                // console.log('Update Document:', updateDoc);

                const adminEmail = 'abc_librarian@email.com';

                if (adminEmail === req.user.email) {
                    const result = await booksCollection.updateOne(query, updateDoc, options);
                    // console.log('Update Result:', result);
                    res.send(result);
                } else if (req.query?.email == req.user.email) {
                    return res.status(403).send(
                        // { message: 'Forbidden access' }
                    );
                }
                return;
            } catch (error) {
                // console.error('Error in updating book details:', error); // Log the specific error
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.delete('/allBooks/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const adminEmail = 'abc_librarian@email.com';

                if (adminEmail === req.user.email) {
                    const result = await booksCollection.deleteOne(query);
                    res.send(result);
                } else if (req.query?.email == req.user.email) {
                    return res.status(403).send(
                        // { message: 'Forbidden access' }
                    );
                }
                return;
            } catch (error) {
                return res.send(error);
            }
        });

        app.delete('/borrowed/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };

                if (req.user.email) {
                    const result = await borrowCollection.deleteOne(query);
                    res.send(result);
                } else if (!req.user.email) {
                    return res.status(401).send(
                        // { message: 'Forbidden access' }
                    );
                }
                return;

            } catch (error) {
                // console.error('Error in deleting item:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });




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