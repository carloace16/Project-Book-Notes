import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";
import methodOverride from "method-override"; // Imports method-override, a middleware for using HTTP verbs like PUT or DELETE in environments that only support POST.

dotenv.config(); // Reads a .env file and populates process.env with its contents.

const app = express();
const port = 3000;
const { Pool } = pg; // Destructure Pool from the pg module

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs"); //Sets the templating engine to ejs.
app.use(methodOverride("_method")); // Ensure methodOverride is here

// Debugging methodOverride middleware
app.use(
  methodOverride((req, res) => {
    console.log("Method Override:", req.method); // Debug log
    return req.body && req.body._method ? req.body._method : req.method;
  })
);

// Routes
app.get("/", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "select * from books order by date_read desc"
    );
    client.release();
    res.render("index", { books: result.rows });
  } catch (err) {
    console.error("Failed to fetch books: ", err.message);
    res.status(500).send("Error retrieving books.");
  }
});

//Add Book Form (GET /add):
app.get("/add", (req, res) => {
  res.render("addBook");
});

//Add Book Submission (POST /add):
app.post("/add", async (req, res) => {
  const { title, author, rating, date_read, notes, isbn } = req.body; //this is from addBook.ejs name
  let cover_url = null;
  try {
    const response = await axios.get(
      `https://covers.openlibrary.org/b/ISBN/${isbn}-L.jpg`
    );
    cover_url = response.config.url;
  } catch (err) {
    console.warn("Could not fetch cover URL:", err.message);
  }

  try {
    const client = await pool.connect();
    await client.query(
      `insert into books(title,author,rating,date_read,notes,cover_url) values ($1,$2,$3,$4,$5,$6)`,
      [title, author, rating, date_read, notes, cover_url]
    );
    client.release();
    res.redirect("/");
  } catch (err) {
    console.error("Failed to add book:", err.message);
    res.status(500).send("Error adding book.");
  }
});

// Route to show the edit form with existing book details
app.get("/edit/:id", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM books WHERE id = $1", [
      req.params.id,
    ]);
    client.release();

    if (result.rows.length > 0) {
      res.render("editBook", { book: result.rows[0] });
    } else {
      res.status(404).send("Book not found.");
    }
  } catch (err) {
    console.error("Error fetching book for editing:", err.message);
    res.status(500).send("Error fetching book details.");
  }
});

// PUT route to handle the updated book data from the edit form
app.put("/edit/:id", async (req, res) => {
  const { title, author, rating, notes } = req.body;

  try {
    const client = await pool.connect();
    await client.query(
      `UPDATE books SET title = $1, author = $2, rating = $3, notes = $4 WHERE id = $5`,
      [title, author, rating, notes, req.params.id]
    );
    client.release();
    res.redirect("/");
  } catch (err) {
    console.error("Failed to update book:", err.message);
    res.status(500).send("Error updating book.");
  }
});

// Delete route
app.post("/delete/:id", async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM books WHERE id = $1", [req.params.id]);
    client.release();
    res.redirect("/");
  } catch (error) {
    console.error("Failed to delete book:", error.message);
    res.status(500).send("Error deleting book.");
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
