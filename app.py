from flask import Flask, jsonify, request
import quip
from markdownify import markdownify as md
from dotenv import load_dotenv
import os
import re

# Load environment variables
load_dotenv()

app = Flask(__name__)

QUIP_TOKEN = os.getenv("QUIP_TOKEN")
QUIP_BASE_URL = os.getenv("QUIP_BASE_URL", "https://platform.quip-amazon.com")
DOCUMENT_ID = os.getenv("QUIP_DOCUMENT_ID")

client = quip.QuipClient(
    access_token=QUIP_TOKEN,
    base_url=QUIP_BASE_URL
)

# Field mapping based on column index
field_map = {
    1: "email",
    2: "password",
    3: "marketplace",
    4: "customer_id",
    5: "type",
    6: "date"
}

@app.route('/accounts', methods=['GET'])
def get_accounts():
    try:
        filter_marketplace = request.args.get('marketplace', '').lower()
        filter_type = request.args.get('type', '').lower()

        doc = client.get_thread(DOCUMENT_ID)
        content = md(doc['html'])

        accounts = []
        lines = content.strip().splitlines()
        parsed_rows = []
        for line in lines:
            if line.startswith("|") and "---" not in line:
                cells = [cell.strip() for cell in line.strip("|").split("|")]
                parsed_rows.append(dict(enumerate(cells)))

        if not parsed_rows:
            return jsonify([])

        for row in parsed_rows[1:]:
            mapped_row = {field_map[k]: v for k, v in row.items() if k in field_map}
            if ((not filter_marketplace or mapped_row["marketplace"].lower() == filter_marketplace) and
                (not filter_type or mapped_row["type"].lower() == filter_type)):
                accounts.append(mapped_row)

        return jsonify(accounts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/use_account', methods=['POST'])
def mark_account_as_used():
    try:
        email = request.json.get("email")
        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Fetch the document and locate the row
        thread = client.get_thread(DOCUMENT_ID)
        html = thread['html']

        # Convert to markdown and back to find the line index
        content = md(html)
        lines = content.strip().splitlines()
        updated_lines = []
        found = False

        for line in lines:
            if line.startswith("|") and "---" not in line and email in line:
                cells = [cell.strip() for cell in line.strip("|").split("|")]
                # Assuming "type" is at index 5
                cells[5] = "member"
                updated_line = "| " + " | ".join(cells) + " |"
                updated_lines.append(updated_line)
                found = True
            else:
                updated_lines.append(line)

        if not found:
            return jsonify({"error": "Email not found"}), 404

        # Rebuild markdown and update doc
        updated_md = "\n".join(updated_lines)
        client.edit_document(document_id=DOCUMENT_ID, content=updated_md, format='markdown')

        return jsonify({"message": "Account marked as member"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
