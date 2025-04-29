import { openDB } from 'idb';
import type { DBSchema } from 'idb';

// Define the schema for our database
interface BookDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: {
      'by-updated-at': Date;
    };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

// Book schema with all required fields
export interface Book {
  id: string;
  title: string;
  authors: string[];
  markdown: string;
  file: Blob;
  cover: Blob;
  createdAt: Date;
  updatedAt: Date;
  progress: number;
  location: string;  
}

// API settings for LLM integration
export interface Settings {
  id: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  updatedAt: Date;
}

const DB_NAME = 'zest-library';
const DB_VERSION = 1;

// Initialize the database
export async function initDB() {
  return openDB<BookDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create the books object store if it doesn't exist
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('by-updated-at', 'updatedAt');
      }

      // Create the settings object store if it doesn't exist
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });
}

// Add a new book to the database
export async function addBook(book: Book): Promise<string> {
  const db = await initDB();
  return db.put('books', book);
}

// Get all books from the database, sorted by updatedAt (most recent first)
export async function getAllBooks(): Promise<Book[]> {
  const db = await initDB();
  const index = db.transaction('books').objectStore('books').index('by-updated-at');
  
  const books: Book[] = [];
  let cursor = await index.openCursor(null, 'prev');
  
  while (cursor) {
    books.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return books;
}

// Get a single book by ID
export async function getBook(id: string): Promise<Book | undefined> {
  const db = await initDB();
  return db.get('books', id);
}

// Update an existing book
export async function updateBook(book: Book): Promise<string> {
  const db = await initDB();
  book.updatedAt = new Date(); // Always update the updatedAt timestamp
  return db.put('books', book);
}

// Delete a book
export async function deleteBook(id: string): Promise<void> {
  const db = await initDB();
  return db.delete('books', id);
}

// Get LLM API settings
export async function getSettings(): Promise<Settings | undefined> {
  const db = await initDB();
  return db.get('settings', 'llm-settings');
}

// Save LLM API settings
export async function saveSettings(settings: Omit<Settings, 'id' | 'updatedAt'>): Promise<string> {
  const db = await initDB();
  const updatedSettings: Settings = {
    ...settings,
    id: 'llm-settings',
    updatedAt: new Date()
  };
  return db.put('settings', updatedSettings);
}
