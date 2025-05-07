import type { Route } from "./+types/books.$bookId";
import { useRef, useEffect } from "react";
import { redirect } from "react-router";
import * as EPUBJS from 'epubjs';
import { deleteBook, getBook, updateBook } from "../utils/db";
import { TopBar } from "../components/TopBar";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Reading - Zest` },
    { name: "description", content: "Read your book with Zest" },
  ];
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {      
    const method = request.method;
    const {bookId} = params
        
    if (method === "DELETE") {
      await deleteBook(bookId);
      return redirect("/")      
    }    
    
    if (method === "POST") {
      const formData = await request.formData();
      console.log("post", formData);      
    }
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { bookId } = params;
  const book = await getBook(bookId);

  // Convert Blob to ArrayBuffer for EPUBJS
  const arrayBuffer = await book!.file.arrayBuffer();
  const epub = EPUBJS.default(arrayBuffer);
  
  return { book, epub };
}


export default function BookViewer({ loaderData }: Route.ComponentProps) {
  const { book, epub } = loaderData;
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

  useEffect(() => {
    if (!viewerRef.current || !epub) return;

    // Render the book
    const rendition = epub.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      spread: "none"
    });
    renditionRef.current = rendition;

    // Load the saved location if available
    const startReading = async () => {
      await epub.ready;
      await epub.locations.generate(1024)
      if (book.location) {
        rendition.display(book.location);
      } else {
        rendition.display();
      }
    };
    
    startReading();

    // Save location when user navigates
    const saveLocation = async (location: any) => {
      if (!book) return;
      console.log({location})
      const {start, end, percentage} = location;
      console.log({start, percentage})
      
      // Update the book with the new location and progress
      await updateBook({
        ...book,
        location: start,
        progress: percentage * 100
      });
    };

    rendition.on("locationChanged", saveLocation);

    // Key event listeners for navigation
    const keyListener = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        rendition.next();
      } else if (e.key === "ArrowLeft") {
        rendition.prev();
      }
    };

    document.addEventListener("keyup", keyListener);

    return () => {
      document.removeEventListener("keyup", keyListener);
      if (renditionRef.current) {
        renditionRef.current.off("locationChanged", saveLocation);
      }
    };
  }, [epub, book]);

  return (
    <div className="flex flex-col h-screen">
      {/* Use the shared TopBar component */}
      <TopBar currentPage="reader" bookId={book.id} />

      {/* Book Viewer */}
      <div 
        ref={viewerRef} 
        className="flex-grow overflow-hidden"
        style={{ height: "calc(100vh - 56px)" }}
      ></div>
      
      {/* Navigation Controls */}
      <div className="fixed bottom-0 left-0 right-0 p-2 flex justify-between bg-white/80 backdrop-blur-sm">
        <button 
          onClick={() => {
            renditionRef.current?.prev();
          }}
          className="p-2 rounded-full bg-yellow-500 text-white"
          aria-label="Previous page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button 
          onClick={() => {
            renditionRef.current?.next();
          }}
          className="p-2 rounded-full bg-yellow-500 text-white"
          aria-label="Next page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
} 