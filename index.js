const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware 
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@pheroprojectdbcluster.qyoezfv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// middleware
const logger = async (req, res, next) => {
    console.log('called', req.host, req.originalUrl)
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    // console.log('midl', token);
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized user' })
    }
    jwt.verify(token, process.env.ACCESS_TOCKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log('inside err', err)
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        // console.log('inside of if valid', decoded)
        req.user = decoded;
        next();
    })

}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const booksCollection = client.db('bookLibraryDB').collection('books');
        const borrowCollection = client.db('bookLibraryDB').collection('borrowed');


        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOCKEN_SECRET, { expiresIn: '1h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                    // sameSite: 'none'
                }).send({ success: true });
        });

        app.post('/addBook', verifyToken, async (req, res) => {
            try {
                const bookInfo = req.body;

                if (req.user.email === 'abc_librarian@email.com') {
                    const result = await booksCollection.insertOne(bookInfo);
                    // console.log(bookInfo);
                    res.send(result);
                } else {
                    return res.status(403).send({ message: 'Forbidden access' });
                }
            } catch (error) {
                // console.error('Error in adding book:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });


        app.get('/allBooks', verifyToken, async (req, res) => {
            try {
                // console.log(req.query);
                // console.log(req.headers);

                if (req.user.email !== 'abc_librarian@email.com') {
                    return res.status(403).send({ message: 'Forbidden access' });
                }

                const options = {
                    sort: { returnDate: 1 },
                };

                const result = await booksCollection.find().toArray();
                res.send(result);
            } catch (error) {
                // console.error('Error in fetching all books:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.get('/booksByCat', async (req, res) => {
            try {
                const query = { category: req.query?.category };
                const options = {
                    sort: { name: 1 },
                };

                if (!req.query.category) {
                    const result = await booksCollection.find({}, options).toArray();
                    // console.log(result);
                    return res.send(result);
                }

                const result = await booksCollection.find(query, options).toArray();
                res.send(result);
            } catch (error) {
                // console.error('Error in fetching books by category:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.get('/books/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await booksCollection.findOne(query);

                if (result) {
                    res.send(result);
                } else {
                    return res.status(404).send({ message: 'Book not found' });
                }
            } catch (error) {
                // console.error('Error in fetching book by ID:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        // get info from db borroewd books by specific user
        app.get('/borrowed', verifyToken, async (req, res) => {
            try {
                // console.log(req.query?.email);
                // console.log(req.user.email);

                const query = { email: req.query.email };

                if (req.query?.email === req.user.email) {
                    const options = {
                        sort: { returnDate: 1 },
                    };

                    const result = await borrowCollection.find(query, options).toArray();
                    res.send(result);
                } else {
                    return res.status(403).send({ message: 'Forbidden access' });
                }
            } catch (error) {
                // console.error('Error in fetching borrowed items:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.post('/borrowed', async (req, res) => {
            const borrow = req.body;
            // console.log(borrow);
            const result = await borrowCollection.insertOne(borrow);
            res.send(result);

        })

        // to decrease qty of book to borrow
        app.patch('/books/:_id/decrease', async (req, res) => {
            try {
                const id = req.params._id;
                const query = { _id: new ObjectId(id) };
                const update = { $inc: { qty: -1 } }; // Decrease qty by 1
                const options = { returnOriginal: false };

                const result = await booksCollection.findOneAndUpdate(query, update, options);

                if (result.value) {
                    res.send(result);
                } else {
                    return res.status(404).send({ message: 'Book not found' });
                }
            } catch (error) {
                // console.error('Error in decreasing book quantity:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        // to increase qty of book to borrow
        app.patch('/books/:_id/increase', async (req, res) => {
            try {
                const bookId = req.params._id;
                const query = { _id: new ObjectId(bookId) };
                const update = { $inc: { qty: 1 } }; // Increase qty by 1
                const options = { returnOriginal: false };

                const result = await booksCollection.findOneAndUpdate(query, update, options);

                if (result.value) {
                    res.send(result);
                } else {
                    return res.status(404).send({ message: 'Book not found' });
                }
            } catch (error) {
                // console.error('Error in increasing book quantity:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });
        app.put('/books/:_id', async (req, res) => {
            try {
                const bookId = req.params._id
                const updateBook = req.body;
                // console.log(bookId);
                // console.log(updateBook);
                const query = { _id: new ObjectId(bookId) };
                const options = { upsert: true };
                const updateDoc = {
                    $set: {
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
                        language: updateBook.language
                        // Add other fields as needed
                    },
                };
                const result = await booksCollection.updateOne(query, updateDoc, options);
                console.log(result);

                if (result.value) {
                    // res.send(result);
                } else {
                    return res.status(404).send({ message: 'Book not found' });
                }
            } catch (error) {
                // console.error('Error in increasing book quantity:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        // app.delete('/allBooks/:id', verifyToken, async (req, res) => {
        //     try {
        //         const id = req.params.id;
        //         console.log(id)
        //         const query = { _id: new ObjectId(_id) };
        //         console.log(query)
        //         const result = await booksCollection.deleteOne(query);
        //         console.log(result);
        //         if (result.deletedCount === 1) {
        //             // res.send(result);
        //         } else {
        //             return res.status(404).send({ message: 'Item not found' });
        //         }

        //     } catch (error) {
        //         // console.error('Error in deleting item:', error);
        //         return res.status(500).send({ message: 'Internal server error' });
        //     }

        // })

        app.delete('/allBooks/:id', async (req, res) => {
            try {
                const id = req.params.id; // Access the 'id' parameter correctly
                const query = { _id: new ObjectId(id) };
                console.log()
                const result = await booksCollection.deleteOne(query);

                if (result.deletedCount > 0) {
                    res.send(result);
                } else {
                    return res.status(404).send({ message: 'Item not found' });
                }
            } catch (error) {
                // console.error('Error in deleting item:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });
        app.delete('/borrowed/:id', async (req, res) => {
            try {
                const id = req.params.id; // Access the 'id' parameter correctly
                const query = { _id: new ObjectId(id) };
                const result = await borrowCollection.deleteOne(query);

                if (result.deletedCount === 1) {
                    res.send(result);
                } else {
                    return res.status(404).send({ message: 'Item not found' });
                }
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