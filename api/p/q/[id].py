from http.server import BaseHTTPRequestHandler
from packsmart_engine import load_analysis, trace_page


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        try:
            analysis_id = self.path.rstrip("/").split("/")[-1]

            record = load_analysis(analysis_id)

            if not record:
                self._send(404, "Traceability record not found.")
                return

            self._send(200, trace_page(record), "text/html")

        except Exception as error:
            self._send(500, f"Traceability error: {error}")

    def _send(self, status, body, content_type="text/plain"):
        if isinstance(body, str):
            body = body.encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)