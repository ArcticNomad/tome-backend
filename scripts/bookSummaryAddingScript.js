const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');

// Book Schema (with summary field)
const bookSchema = new mongoose.Schema({
    gutenbergId: { type: Number, unique: true, sparse: true },
    title: { type: String, required: true },
    isbn: { type: String, unique: true, sparse: true }, 
    author: { type: String, required: true },
    subjects: { type: [String] },
    downloadCount: { type: Number },
    issuedDate: { type: Date },
    readingEaseScore: { type: Number },
    coverImageUrl: { type: String },
    isAvailable: { type: Boolean },
    summary: { type: String }
});
const Book = mongoose.model('Book', bookSchema);

// Utility for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Try to get summary from Wikipedia API
 */
const fetchSummaryFromWikipedia = async (title, author) => {
    try {
        // Clean the title - remove subtitles after colon/semicolon
        const cleanTitle = title.split(/[:;]/)[0].trim();
        
        // Try different search queries
        const searchQueries = [
            `${cleanTitle} ${author}`,
            cleanTitle,
            `${cleanTitle} (novel)`,
            `${cleanTitle} (book)`
        ];

        for (const query of searchQueries) {
            console.log(`  Searching Wikipedia for: "${query}"`);
            
            const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            
            try {
                const response = await axios.get(searchUrl, { timeout: 10000 });
                const data = response.data;
                
                if (data.extract && data.extract.length > 100) {
                    console.log(`  ✅ Found Wikipedia summary for "${cleanTitle}"`);
                    return data.extract;
                }
            } catch (error) {
                // Continue to next search query if this one fails
                continue;
            }
            
            await delay(1000); // Delay between Wikipedia requests
        }
        
        return null;
    } catch (error) {
        console.log(`  ❌ Wikipedia search failed for "${title}": ${error.message}`);
        return null;
    }
};

/**
 * Generate a basic summary using book metadata
 */
const generateBasicSummary = (title, author, subjects) => {
    const mainSubject = subjects && subjects.length > 0 ? subjects[0] : 'classic literature';
    
    const summaries = [
        `A ${mainSubject.toLowerCase()} work by ${author}, "${title}" is considered a classic of its genre and continues to captivate readers with its timeless themes and compelling narrative.`,
        `Written by ${author}, "${title}" stands as a masterpiece of ${mainSubject.toLowerCase()} that explores profound human experiences and societal themes through its memorable characters and plot.`,
        `This renowned work by ${author}, "${title}" represents a significant contribution to ${mainSubject.toLowerCase()} and remains influential for its artistic merit and cultural impact.`,
        `"${title}" by ${author} is a celebrated piece of ${mainSubject.toLowerCase()} that has endured through generations, offering readers deep insights into the human condition.`
    ];
    
    return summaries[Math.floor(Math.random() * summaries.length)];
};

/**
 * Try multiple sources to get book summary
 */
const fetchBookSummary = async (book) => {
    console.log(`\n📖 Processing: "${book.title}" by ${book.author}`);
    
    // Try Wikipedia first
    const wikipediaSummary = await fetchSummaryFromWikipedia(book.title, book.author);
    if (wikipediaSummary) {
        return wikipediaSummary.substring(0, 1500); // Limit length
    }
    
    // If Wikipedia fails, generate a basic summary from metadata
    console.log(`  ⚠️  No Wikipedia summary found, generating from metadata`);
    const basicSummary = generateBasicSummary(book.title, book.author, book.subjects);
    return basicSummary;
};

/**
 * Main function to update all books with summaries
 */
const updateBooksWithSummaries = async () => {
    try {
        console.log('📚 Starting book summary update process...\n');
        
        // Get all books that don't have summaries
        const books = await Book.find({ summary: { $exists: false } }, 'gutenbergId title author subjects').lean();
        console.log(`📖 Found ${books.length} books without summaries\n`);
        
        if (books.length === 0) {
            console.log('✅ All books already have summaries!');
            return { total: 0, updated: 0, errors: 0 };
        }
        
        let updatedCount = 0;
        let errorCount = 0;
        
        // Process books with longer delays to respect API limits
        const batchSize = 3;
        const delayBetweenBooks = 2000; // 2 seconds between books
        const delayBetweenBatches = 5000; // 5 seconds between batches
        
        for (let i = 0; i < books.length; i += batchSize) {
            const batch = books.slice(i, i + batchSize);
            console.log(`\n--- Processing batch ${Math.floor(i/batchSize) + 1} ---`);
            
            for (const book of batch) {
                try {
                    const summary = await fetchBookSummary(book);
                    
                    if (summary) {
                        await Book.updateOne(
                            { _id: book._id },
                            { $set: { summary: summary } }
                        );
                        console.log(`✅ Updated "${book.title}"`);
                        updatedCount++;
                    } else {
                        console.log(`❌ Could not get summary for "${book.title}"`);
                        errorCount++;
                    }
                    
                    // Delay between individual books
                    await delay(delayBetweenBooks);
                    
                } catch (error) {
                    console.error(`💥 Error processing book ${book.gutenbergId}:`, error.message);
                    errorCount++;
                }
            }
            
            // Longer delay between batches
            if (i + batchSize < books.length) {
                console.log(`\n⏳ Waiting ${delayBetweenBatches/1000} seconds before next batch...`);
                await delay(delayBetweenBatches);
            }
        }
        
        return {
            total: books.length,
            updated: updatedCount,
            errors: errorCount
        };
        
    } catch (error) {
        console.error('💥 Fatal error in update process:', error);
        throw error;
    }
};

// Alternative: Bulk update with basic summaries (faster but less accurate)
const addBasicSummariesBulk = async () => {
    try {
        console.log('🚀 Starting bulk summary addition with generated summaries...\n');
        
        const books = await Book.find({ summary: { $exists: false } }, 'gutenbergId title author subjects').lean();
        console.log(`📖 Found ${books.length} books without summaries\n`);
        
        let updatedCount = 0;
        
        for (const book of books) {
            const basicSummary = generateBasicSummary(book.title, book.author, book.subjects);
            
            await Book.updateOne(
                { _id: book._id },
                { $set: { summary: basicSummary } }
            );
            
            updatedCount++;
            if (updatedCount % 50 === 0) {
                console.log(`✅ Updated ${updatedCount} books...`);
            }
        }
        
        console.log(`\n✅ Bulk update complete! Updated ${updatedCount} books with basic summaries.`);
        return { total: books.length, updated: updatedCount };
        
    } catch (error) {
        console.error('💥 Error in bulk update:', error);
        throw error;
    }
};

// Main execution function
const runSummaryUpdate = async () => {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
        console.error("FATAL ERROR: MONGO_URI environment variable must be set.");
        process.exit(1);
    }
    
    try {
        console.log('🔗 Attempting to connect to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully.\n');
        
        // Ask user which method to use
        console.log('Choose update method:');
        console.log('1. Wikipedia + Generated summaries (slower, better quality)');
        console.log('2. Bulk generated summaries only (faster, basic quality)');
        
        // For simplicity, we'll use method 2 automatically
        // You can modify this to accept user input if needed
        const method = 2; // Change to 1 for Wikipedia method
        
        let result;
        if (method === 1) {
            result = await updateBooksWithSummaries();
        } else {
            result = await addBasicSummariesBulk();
        }
        
        console.log('\n--- Summary Update Complete ---');
        console.log(`📊 Total Books Processed: ${result.total}`);
        console.log(`✅ Successfully Updated: ${result.updated}`);
        if (result.errors) {
            console.log(`❌ Errors: ${result.errors}`);
        }
        
    } catch (error) {
        console.error('❌ Script execution failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed.');
    }
};

// Run the script
runSummaryUpdate();