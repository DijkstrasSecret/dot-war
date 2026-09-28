"""Tiny development server: like `python -m http.server` but sends no-cache headers,
so edited scripts are always reloaded. Usage: python serve.py [port]"""
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f'Dot War dev server on http://127.0.0.1:{port}')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
