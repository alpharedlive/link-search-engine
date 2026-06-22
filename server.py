import http.server
import socketserver
import json
import urllib.parse
import os
import uuid

PORT = 8000
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'links.json')

def load_links():
    if not os.path.exists(DATA_FILE):
        # Default curated links to start with
        default_links = [
            {
                "id": "1",
                "url": "https://www.google.com",
                "title": "Google Search",
                "description": "The world's most popular search engine to find information, images, videos, and more.",
                "keywords": ["search", "google", "web", "find", "engine"],
                "clickCount": 10
            },
            {
                "id": "2",
                "url": "https://github.com",
                "title": "GitHub",
                "description": "A developer platform for hosting, version control, and collaboration on software projects.",
                "keywords": ["code", "github", "git", "repository", "programming", "developer", "open source"],
                "clickCount": 8
            },
            {
                "id": "3",
                "url": "https://news.ycombinator.com",
                "title": "Hacker News",
                "description": "A social news website focusing on computer science, entrepreneurship, and technical curiosity.",
                "keywords": ["news", "tech", "hacker news", "ycombinator", "yc", "startup", "articles"],
                "clickCount": 5
            },
            {
                "id": "4",
                "url": "https://stackoverflow.com",
                "title": "Stack Overflow",
                "description": "The largest online community for programmers to learn, share their knowledge, and build their careers.",
                "keywords": ["help", "programming", "code", "bugs", "errors", "questions", "answers"],
                "clickCount": 7
            },
            {
                "id": "5",
                "url": "https://wikipedia.org",
                "title": "Wikipedia",
                "description": "A free multilingual online encyclopedia written and maintained by a community of volunteers.",
                "keywords": ["info", "knowledge", "encyclopedia", "learn", "facts", "history", "wiki"],
                "clickCount": 12
            }
        ]
        save_links(default_links)
        return default_links
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def save_links(links):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(links, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving database: {e}")

class SearchEngineHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Determine the public directory path and ensure it exists
        public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
        if not os.path.exists(public_dir):
            os.makedirs(public_dir)
        super().__init__(*args, directory=public_dir, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # CORS preflight / simple header injection
        if path == '/api/links':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            links = load_links()
            self.wfile.write(json.dumps(links).encode('utf-8'))
            return

        elif path == '/api/search':
            query = query_params.get('q', [''])[0].strip().lower()
            links = load_links()
            
            if not query:
                # If search query is empty, return top clicked links as popular recommendations
                results = sorted(links, key=lambda x: x.get('clickCount', 0), reverse=True)[:5]
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
                return

            scored_results = []
            query_words = query.split()
            
            for link in links:
                score = 0
                title = link.get('title', '').lower()
                desc = link.get('description', '').lower()
                url = link.get('url', '').lower()
                keywords = [k.lower() for k in link.get('keywords', [])]

                # Match logic scoring system:
                # 1. Exact match in title
                if query == title:
                    score += 150
                
                # 2. Word matching in title
                for word in query_words:
                    if word in title:
                        score += 30
                        
                # 3. Exact keyword match
                for word in query_words:
                    if word in keywords:
                        score += 40
                    # Partial keyword match
                    for kw in keywords:
                        if word in kw:
                            score += 10

                # 4. Matching in description
                for word in query_words:
                    if word in desc:
                        score += 15

                # 5. Matching in URL domain/path
                for word in query_words:
                    if word in url:
                        score += 20

                # Only include links with positive match scores
                if score > 0:
                    scored_results.append((score, link))

            # Sort descending: high scores first, break ties with higher clickCount
            scored_results.sort(key=lambda x: (x[0], x[1].get('clickCount', 0)), reverse=True)
            results = [item[1] for item in scored_results]

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode('utf-8'))
            return

        # Serve files normally via parent SimpleHTTPRequestHandler
        super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == '/api/links':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                new_link = json.loads(post_data.decode('utf-8'))
                if not new_link.get('title') or not new_link.get('url'):
                    self.send_error_response(400, "Title and URL are required fields")
                    return

                links = load_links()
                
                # Format keywords
                keywords = new_link.get('keywords', [])
                if isinstance(keywords, str):
                    keywords = [k.strip() for k in keywords.split(',') if k.strip()]
                elif not isinstance(keywords, list):
                    keywords = []

                # Format and validate URL
                url = new_link.get('url', '').strip()
                if not (url.startswith('http://') or url.startswith('https://')):
                    url = 'https://' + url

                link_item = {
                    "id": str(uuid.uuid4()),
                    "title": new_link.get('title', '').strip(),
                    "url": url,
                    "description": new_link.get('description', '').strip(),
                    "keywords": keywords,
                    "clickCount": 0
                }

                links.append(link_item)
                save_links(links)
                self.send_success_response(201, link_item)
            except Exception as e:
                self.send_error_response(500, f"Server Error: {str(e)}")
            return

        elif path == '/api/click':
            # Track link click count
            query_params = urllib.parse.parse_qs(parsed_url.query)
            link_id = query_params.get('id', [''])[0]
            
            if not link_id:
                self.send_error_response(400, "Link ID is required")
                return

            links = load_links()
            updated = False
            for link in links:
                if link.get('id') == link_id:
                    link['clickCount'] = link.get('clickCount', 0) + 1
                    updated = True
                    break
            
            if updated:
                save_links(links)
                self.send_success_response(200, {"success": True})
            else:
                self.send_error_response(404, "Link not found")
            return

        self.send_error_response(404, "Not Found")

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == '/api/links':
            content_length = int(self.headers.get('Content-Length', 0))
            put_data = self.rfile.read(content_length)
            
            try:
                updated_data = json.loads(put_data.decode('utf-8'))
                link_id = updated_data.get('id')
                
                if not link_id:
                    self.send_error_response(400, "Link ID is required for editing")
                    return

                links = load_links()
                found_idx = -1
                for idx, link in enumerate(links):
                    if link.get('id') == link_id:
                        found_idx = idx
                        break

                if found_idx == -1:
                    self.send_error_response(404, "Link not found")
                    return

                # Update the target link details
                url = updated_data.get('url', links[found_idx]['url']).strip()
                if not (url.startswith('http://') or url.startswith('https://')):
                    url = 'https://' + url

                keywords = updated_data.get('keywords', links[found_idx].get('keywords', []))
                if isinstance(keywords, str):
                    keywords = [k.strip() for k in keywords.split(',') if k.strip()]

                links[found_idx]['title'] = updated_data.get('title', links[found_idx]['title']).strip()
                links[found_idx]['url'] = url
                links[found_idx]['description'] = updated_data.get('description', links[found_idx].get('description', '')).strip()
                links[found_idx]['keywords'] = keywords
                
                save_links(links)
                self.send_success_response(200, links[found_idx])
            except Exception as e:
                self.send_error_response(500, f"Server Error: {str(e)}")
            return

        self.send_error_response(404, "Not Found")

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == '/api/links':
            link_id = query_params.get('id', [''])[0]
            
            if not link_id:
                self.send_error_response(400, "Link ID is required")
                return

            links = load_links()
            filtered_links = [l for l in links if l.get('id') != link_id]
            
            if len(filtered_links) < len(links):
                save_links(filtered_links)
                self.send_success_response(200, {"success": True, "message": "Link successfully deleted"})
            else:
                self.send_error_response(404, "Link not found")
            return

        self.send_error_response(404, "Not Found")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_success_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    server_address = ('', PORT)
    
    public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
    os.makedirs(public_dir, exist_ok=True)
    os.makedirs(os.path.join(public_dir, 'css'), exist_ok=True)
    os.makedirs(os.path.join(public_dir, 'js'), exist_ok=True)

    # Initialize default links if not exists
    load_links()

    httpd = socketserver.TCPServer(server_address, SearchEngineHandler)
    print(f"Search engine server launched at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
