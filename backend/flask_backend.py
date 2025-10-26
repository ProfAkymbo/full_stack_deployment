# app.py
from flask import Flask, jsonify, request, abort
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling, Error
import os

app = Flask(__name__)
# allow your frontend origin(s) — adjust if needed
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# MySQL connection settings — replace with your values or use env vars
DB_CONFIG = {
    "user": os.getenv("DB_USER", "todo_user"),
    "password": os.getenv("DB_PASSWORD", "profakymbo"),
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "database": os.getenv("DB_NAME", "todo_list"),
    "port": int(os.getenv("DB_PORT", 3306)),
}

# Create a connection pool
POOL_NAME = "mypool"
POOL_SIZE = 5
try:
    cnxpool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name=POOL_NAME,
        pool_size=POOL_SIZE,
        **DB_CONFIG
    )
except Error as e:
    # If pool creation fails, raise; app won't start correctly without DB
    raise RuntimeError(f"Failed to create DB pool: {e}")

def init_db():
    """Create table if it doesn't exist."""
    conn = None
    cursor = None
    try:
        conn = cnxpool.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS todos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                completed TINYINT(1) NOT NULL DEFAULT 0
            )
        ''')
        conn.commit()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# initialize DB table at startup
init_db()

@app.route("/todos", methods=["GET"])
def get_all_todos():
    conn = None
    cursor = None
    try:
        conn = cnxpool.get_connection()
        # dictionary=True returns rows as dicts
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, title, completed FROM todos ORDER BY id ASC")
        rows = cursor.fetchall()
        # convert completed 0/1 to boolean
        todos = [
            {"id": r["id"], "title": r["title"], "completed": bool(r["completed"])}
            for r in rows
        ]
        return jsonify(todos), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/todos", methods=["POST"])
def create_todo():
    if not request.is_json:
        abort(400, description="Request body must be JSON")
    title = request.json.get("title", "").strip()
    if not title:
        abort(400, description="Title is required")

    conn = None
    cursor = None
    try:
        conn = cnxpool.get_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO todos (title) VALUES (%s)", (title,))
        conn.commit()
        todo_id = cursor.lastrowid
        # return the created resource (id + title + completed)
        created = {"id": todo_id, "title": title, "completed": False}
        return jsonify(created), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# ...existing code...
@app.route("/todos/<int:todo_id>", methods=["PUT"])
def update_todo(todo_id):
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "invalid json"}), 400

    title = data.get("title")
    completed = data.get("completed")

    conn = None
    cursor = None
    try:
        conn = cnxpool.get_connection()
        cursor = conn.cursor(dictionary=True)

        # Build SQL to update only provided fields
        updates = []
        params = []
        if title is not None:
            updates.append("title = %s")
            params.append(title)
        if completed is not None:
            # ensure boolean -> tinyint
            updates.append("completed = %s")
            params.append(1 if bool(completed) else 0)

        if not updates:
            return jsonify({"error": "no fields to update"}), 400

        params.append(todo_id)
        sql = f"UPDATE todos SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(sql, params)
        conn.commit()

        # return the updated row
        cursor.execute("SELECT id, title, completed FROM todos WHERE id = %s", (todo_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404

        # convert completed to boolean
        row["completed"] = bool(row["completed"])
        return jsonify(row), 200

    except Error as e:
        app.logger.error("DB error on update: %s", e)
        return jsonify({"error": "database error"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
# ...existing code...

@app.route("/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    conn = None
    cursor = None
    try:
        conn = cnxpool.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM todos WHERE id = %s", (todo_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Todo not found"}), 404
        return jsonify({"message": "Todo deleted successfully"}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    # for local dev only — in production use a WSGI server (gunicorn/uvicorn)
    app.run(host="0.0.0.0", port=5000, debug=True)
