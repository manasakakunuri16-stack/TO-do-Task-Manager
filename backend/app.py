
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path



DB_PATH = Path(__file__).resolve().parent / "tasks.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                deadline TEXT DEFAULT '',
                priority TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Pending'
            )
        """)

        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(tasks)").fetchall()
        }

        migrations = {
            "description": "TEXT DEFAULT ''",
            "deadline": "TEXT DEFAULT ''",
            "priority": "TEXT DEFAULT 'Medium'",
            "status": "TEXT DEFAULT 'Pending'"
        }

        for column, definition in migrations.items():
            if column not in columns:
                conn.execute(
                    f"ALTER TABLE tasks ADD COLUMN {column} {definition}"
                )


@app.route("/")
def home():
    return "To-Do Task Manager backend is running!"


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    status = request.args.get("status", "All")
    search = request.args.get("search", "").strip()

    with get_db() as conn:
        query = "SELECT * FROM tasks WHERE 1=1"
        params = []

        if status in ("Pending", "Completed"):
            query += " AND status = ?"
            params.append(status)

        if search:
            query += " AND (title LIKE ? OR description LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        query += " ORDER BY id DESC"
        rows = conn.execute(query, params).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    priority = data.get("priority", "Medium")
    if priority not in ("Low", "Medium", "High"):
        priority = "Medium"

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO tasks
               (title, description, deadline, priority, status)
               VALUES (?, ?, ?, ?, 'Pending')""",
            (
                title,
                data.get("description", "").strip(),
                data.get("deadline", ""),
                priority,
            ),
        )
        task_id = cursor.lastrowid
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(dict(row)), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    priority = data.get("priority", "Medium")
    if priority not in ("Low", "Medium", "High"):
        priority = "Medium"

    with get_db() as conn:
        existing = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

        if existing is None:
            return jsonify({"error": "Task not found"}), 404

        conn.execute(
            """UPDATE tasks
               SET title = ?, description = ?, deadline = ?, priority = ?
               WHERE id = ?""",
            (
                title,
                data.get("description", "").strip(),
                data.get("deadline", ""),
                priority,
                task_id,
            ),
        )
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(dict(row))


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def change_status(task_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ("Pending", "Completed"):
        return jsonify({"error": "Invalid task status"}), 400

    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE tasks SET status = ? WHERE id = ?",
            (status, task_id),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404

        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(dict(row))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM tasks WHERE id = ?", (task_id,)
        )

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"})


if __name__ == "__main__":
    init_db()
    print("dB CREATED SUCCESSFULLY")
    app.run(debug=True, port=5000)