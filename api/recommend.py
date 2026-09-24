import json
from http.server import BaseHTTPRequestHandler
from packsmart_engine import recommend


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            commodity = json.loads(self.rfile.read(length))

            required = {"category", "aw", "respiration", "fat", "temp"}
            missing = sorted(required - commodity.keys())

            if missing:
                self._send(400, {
                    "error": f"Missing fields: {', '.join(missing)}"
                })
                return

            result = recommend(commodity)

            request_id = self.headers.get("X-Request-ID")
            if request_id:
                result["debug"]["requestId"] = request_id

            self._send(200, result)

        except Exception as error:
            self._send(400, {
                "error": f"Invalid request: {error}"
            })

    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Request-ID")
        self.end_headers()
