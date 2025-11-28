const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');

// NOTE: This script is for one-time manual data ingestion.
// It uses the public Gutendex API (no RAPIDAPI_KEY needed).

// --- UTILITY FOR DELAY ---

// --- BOOK SCHEMA AND MODEL ---
// UPDATED: Schema simplified to include only essential metadata fields (as requested)
const bookSchema = new mongoose.Schema({
    // ESSENTIAL: Identification and Title
    gutenbergId: { type: Number, unique: true, sparse: true },
    title: { type: String, required: true },
    isbn: { type: String, unique: true, sparse: true }, 
    
    // METADATA: Core attributes
    author: { type: String, required: true },
    subjects: { type: [String] }, // Requested array of subjects
    
    // METRICS & FILES: Download info and media
    downloadCount: { type: Number },
    issuedDate: { type: Date },
    readingEaseScore: { type: Number },
    coverImageUrl: { type: String },
    isAvailable: { type: Boolean }
});
const Book = mongoose.model('Book', bookSchema);


/**
 * Fetches 1000 books from the public Gutendex API in a single phase.
 * Pulls all metadata directly from the list endpoint's response.
 */
const fetchAndStoreBooks = async () => {
    // --- Configuration ---
    let booksToFetch = 1000;
    let booksInserted = 0;
    let booksSkipped = 0;
    
    // --- API Details ---
    let url = 'https://gutendex.com/books/'; // Public list endpoint

    console.log(`\n--- Starting single-phase import of ${booksToFetch} books from Gutendex ---`);

    // Helper function to find the best cover image URL from the 'formats' object
    const getCoverUrl = (formats) => {
        // Prioritize JPEG images as they are standard web format
        const jpegKey = Object.keys(formats).find(key => key.startsWith('image/jpeg'));
        if (jpegKey) return formats[jpegKey];
        const imageKey = Object.keys(formats).find(key => key.startsWith('image/'));
        return imageKey ? formats[imageKey] : null;
    };


    while (booksInserted < booksToFetch && url) {
        
        console.log(`\nPHASE 1: Fetching List Page from ${url}`);
        
        try {
            // 1. FETCH BOOK LIST 
            const listResponse = await axios.get(url, {
                params: {
                    mime_type: 'text/plain', // Filter for books with text content
                    language: 'en' // Filter for English books
                }
            });

            const listData = listResponse.data;
            const books = listData.results; 
            
            if (!books || books.length === 0) {
                console.log("No more books found in the API response list. Stopping.");
                break;
            }
            
            // 2. ITERATE AND STORE ALL DATA AVAILABLE ON THIS PAGE
            for (const item of books) {
                if (booksInserted >= booksToFetch) break;
                
                // --- DATA EXTRACTION (Matching Requested Fields) ---
                const authorName = item.authors?.[0]?.name || 'Unknown Author';
                const finalCover = getCoverUrl(item.formats || {}); 
                
                // --- FIX: Guarantee a non-null, unique ISBN placeholder ---
                const uniqueIsbn = item.identifiers?.[0] || `NO_ISBN_${item.id}`; 
                
                const newBook = {
                    // id
                    gutenbergId: item.id,
                    
                    // title
                    title: item.title ? item.title.substring(0, 255) : 'Untitled',
                    
                    // authors[0].name
                    author: authorName,
                    
                    // subjects[]
                    subjects: item.subjects || [], 
                    
                    // download_count
                    downloadCount: item.download_count || 0,
                    
                    // issued
                    issuedDate: item.issued ? new Date(item.issued) : null,
                    
                    // reading_ease_score
                    readingEaseScore: item.reading_ease_score ? parseFloat(item.reading_ease_score) : null,
                    
                    // cover_image
                    coverImageUrl: finalCover, 
                    
                    // is_available
                    isAvailable: item.is_available === true, // Ensure boolean consistency

                    // ISBN placeholder (for uniqueness)
                    isbn: uniqueIsbn
                };

                // Insert into MongoDB Atlas
                await Book.updateOne(
                    { gutenbergId: newBook.gutenbergId },
                    { $setOnInsert: newBook },
                    { upsert: true }
                );
                
                booksInserted++;
                if (booksInserted % 10 === 0) {
                     console.log(`... Inserted ${booksInserted} books.`);
                }
            }

            // --- RATE LIMIT FIX ---
            console.log(`Pausing for 5 seconds between pages to clear API queue...`);
           
            
            // --- END RATE LIMIT FIX ---
            
            // Get the next page URL for the while loop
            url = listData.next;

        } catch (error) {
             // Handle MongoDB errors during insertion
            if (error.code === 11000 || (error.message && error.message.includes('E11000'))) {
                 console.warn(`[WARN] Skipping duplicate key error: ${error.message}`);
                 booksSkipped++;
            } else if (error.response && error.response.status === 429) {
                 // Long retry logic for 429 on list fetch
                 console.warn(`[WARN] API Rate Limit hit (429) during list fetch. Pausing for 30 seconds...`);
                 await delay(30000); 
            } else {
                 console.error('Critical Error during book list import:', error.message);
                 break; 
            }
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
    
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully.');
        
        // --- MANDATORY: Explicitly drop collection to clear indexes and ensure sparse: true applies ---
        try {
            await mongoose.connection.db.dropCollection('books');
            console.log('🗑️ Existing "books" collection dropped to clear old indexes.');
        } catch (e) {
            if (e.message.includes('ns not found')) {
                 console.log('Collection "books" not found. Creating fresh.');
            } else {
                 console.warn(`Could not drop collection, attempting to drop indexes only: ${e.message}`);
                 try {
                     await mongoose.connection.db.collection('books').dropIndexes();
                     console.log('🗑️ Existing collection indexes dropped.');
                 } catch(e) {
                     console.warn(`Could not drop indexes. Proceeding with risk: ${e.message}`);
                 }
            }
        }
        // --- END INDEX FIX ---
        
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