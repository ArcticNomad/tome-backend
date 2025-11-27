const mongoose = require('mongoose');
const axios = require('axios');

// NOTE: This script is for one-time manual data ingestion.
// It requires the MONGO_URI environment variable to be set.
// It now uses the public Gutendex API (no RAPIDAPI_KEY needed).

// --- BOOK SCHEMA AND MODEL ---
// Must match the schema defined in server.js
const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String },
    isbn: { type: String, unique: true },
    embeddingId: { type: String },
    genre: { type: String },
    pages: { type: Number },
    gutenbergId: { type: Number, unique: true }
});
const Book = mongoose.model('Book', bookSchema);


/**
 * Fetches 1000 books from the public Gutendex API
 * and stores their metadata in MongoDB Atlas.
 */
const fetchAndStoreBooks = async () => {
    // --- Configuration ---
    let booksToFetch = 1000;
    let booksInserted = 0;
    let booksSkipped = 0;
    
    // --- API Details ---
    let url = 'https://gutendex.com/books/'; // Public endpoint

    console.log(`\n--- Starting import of ${booksToFetch} books from Gutendex ---`);

    while (booksInserted < booksToFetch && url) {
        
        console.log(`Fetching: ${url}`);
        
        try {
            const response = await axios.get(url, {
                params: {
                    mime_type: 'text/plain', // Filter for text files
                    language: 'en' // Filter for English books
                }
            });

            const data = response.data;
            const books = data.results;
            
            if (!books || books.length === 0) {
                console.log("No more books found in the API response. Stopping.");
                break;
            }

            for (const item of books) {
                if (booksInserted >= booksToFetch) break;

                // Extracting metadata fields
                const authorName = item.authors[0] ? item.authors[0].name : 'Unknown Author';
                const genres = item.subjects.length > 0 ? item.subjects[0] : 'Fiction';

                const newBook = {
                    title: item.title ? item.title.substring(0, 255) : 'Untitled',
                    author: authorName,
                    description: item.description || item.title,
                    isbn: item.identifiers?.[0] || `gutenberg-${item.id}`,
                    genre: genres,
                    gutenbergId: item.id
                };

                // Insert into MongoDB Atlas (using upsert to prevent duplicates)
                await Book.updateOne(
                    { gutenbergId: newBook.gutenbergId },
                    { $setOnInsert: newBook },
                    { upsert: true }
                );
                
                booksInserted++;
                if (booksInserted % 100 === 0) {
                     console.log(`... Successfully processed ${booksInserted} books.`);
                }
            }

            // Get the next page URL for the while loop
            url = data.next;

        } catch (error) {
            console.error('Critical Error during book import:', error.message);
            url = null; 
        }
    }
    
    return {
        message: `Import complete.`,
        totalTarget: booksToFetch,
        totalInserted: booksInserted,
        totalSkipped: booksSkipped 
    };
};


// --- DATABASE CONNECTION AND EXECUTION ---

const runImport = async () => {
    // Ensure MONGO_URI is checked first
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
        console.error("FATAL ERROR: MONGO_URI environment variable must be set to run the script.");
        process.exit(1);
    }
    
    // Check for the API key only if the fetch function required it (which it now does not)
    // Removed all hidden API key checks from the logic.
    
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully.');
        
        const result = await fetchAndStoreBooks();
        console.log(`\n--- Import complete ---`);
        console.log(`Total Target: ${result.totalTarget}`);
        console.log(`Total Inserted/Updated: ${result.totalInserted}`);
        console.log(`Total Skipped (Duplicates/Errors): ${result.totalSkipped}`);
        
    } catch (error) {
        console.error('❌ Database connection or script execution failed:', error.message);
        process.exit(1);
    } finally {
        // Always close the connection when done
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed.');
    }
};

runImport();