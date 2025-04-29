import type { Route } from "./+types/chats.$chatId";
import { useRef, useEffect, useState } from "react";
import { href, redirect } from "react-router";
import { getBook } from "../utils/db";
import { getSettings } from "../utils/db";
import type { Book } from "../utils/db";
import { TopBar } from "../components/TopBar";
import OpenAI from 'openai';

// Define message interface
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Chat - Zest` },
    { name: "description", content: "Chat about your book with Zest" },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { chatId } = params;
  if (!chatId) {
    throw new Response("Chat ID is required", { status: 400 });
  }
  console.log({chatId})
  // Check if settings are configured
  const settings = await getSettings();

  console.log({settings})
  if (!settings) {
    // Redirect to settings if not configured
    return redirect(href("/settings"));
  }
  
  const book = await getBook(chatId);
  if (!book) {
    throw new Response("Book not found", { status: 404 });
  }

  return { book, settings };
}

// Define the loader data type
type LoaderData = {
  book: Book;
  settings: any;
};

export default function ChatPage({ loaderData }: { loaderData: LoaderData }) {
  const { book, settings } = loaderData;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with a system message about the book
  useEffect(() => {
    if (book && messages.length === 0) {
      setMessages([
        {
          role: 'system',
          content: `The user is reading the book "${book.title}". Help them understand concepts, analyze themes, or answer questions about the content.`
        }
      ]);
    }
  }, [book, messages.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !settings) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const openai = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseUrl,
        dangerouslyAllowBrowser: true // Required for client-side usage
      });

      const response = await openai.chat.completions.create({
        model: settings.modelName,
        messages: [...messages, userMessage],
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message?.content;
      
      if (assistantMessage) {
        setMessages(prev => [
          ...prev, 
          { role: 'assistant', content: assistantMessage }
        ]);
      } else {
        throw new Error('No response from the API');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to get a response. Please check your API settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Use the unified TopBar component */}
      <TopBar currentPage="chat" bookId={book.id} />

      {/* Chat Content */}
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length <= 1 && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-800 mb-2">Chat about "{book.title}"</h3>
                <p className="text-yellow-700">
                  Ask questions about themes, characters, or any aspect of the book you're reading.
                </p>
              </div>
            )}
            
            {messages.filter(msg => msg.role !== 'system').map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-yellow-100 ml-auto max-w-[80%]'
                    : 'bg-white border border-gray-200 mr-auto max-w-[80%]'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            
            {loading && (
              <div className="bg-white border border-gray-200 p-3 rounded-lg mr-auto max-w-[80%]">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-300 p-3 rounded-lg text-red-700 mr-auto max-w-[80%]">
                <p>{error}</p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your book..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                disabled={loading}
              />
              <button
                type="submit"
                className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
                disabled={loading || !input.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 