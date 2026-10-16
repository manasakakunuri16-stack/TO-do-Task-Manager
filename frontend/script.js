const API = "http://127.0.0.1:5000/api/tasks";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const deadlineInput = document.getElementById("deadline");
const priorityInput = document.getElementById("priority");
const filterInput = document.getElementById("filter");
const searchInput = document.getElementById("search");
const overdueInput = document.getElementById("overdue");
const taskList = document.getElementById("task-list");
const listMessage = document.getElementById("list-message");
const formError = document.getElementById("form-error");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const formTitle = document.getElementById("form-title");

let editingId = null;
let searchTimer;

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function showError(message) {
    formError.textContent = message;
}

function resetForm() {
    form.reset();
    editingId = null;
    formTitle.textContent = "Add New Task";
    saveButton.textContent = "Add Task";
    cancelButton.hidden = true;
    formError.textContent = "";
}

cancelButton.addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const title = titleInput.value.trim();

    if (!title) {
        showError("Please enter a task title.");
        titleInput.focus();
        return;
    }

    const task = {
        title,
        description: descriptionInput.value.trim(),
        deadline: deadlineInput.value,
        priority: priorityInput.value
    };

    try {
        if (editingId !== null) {
            await apiRequest(`${API}/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(task)
            });
        } else {
            await apiRequest(API, {
                method: "POST",
                body: JSON.stringify(task)
            });
        }

        resetForm();
        await loadTasks();
    } catch (error) {
        showError(error.message);
    }
});

async function loadTasks() {
    listMessage.textContent = "Loading tasks...";
    taskList.replaceChildren();

    const params = new URLSearchParams({
        status: filterInput.value,
        search: searchInput.value.trim(),
        overdue: String(overdueInput.checked)
    });

    try {
        const tasks = await apiRequest(`${API}?${params}`);

        listMessage.textContent = tasks.length
            ? `${tasks.length} task(s) found`
            : "No tasks found. Add your first task!";

        tasks.forEach(renderTask);
    } catch (error) {
        listMessage.textContent =
            `${error.message} Check whether the Flask server is running.`;
    }
}

function addTag(parent, text, className = "") {
    const tag = document.createElement("span");
    tag.className = `tag ${className}`.trim();
    tag.textContent = text;
    parent.appendChild(tag);
}

function addButton(parent, text, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = className;
    button.addEventListener("click", handler);
    parent.appendChild(button);
}

function renderTask(task) {
    const card = document.createElement("article");
    card.className = "task-card";

    if (task.status === "Completed") card.classList.add("completed");
    if (task.overdue) card.classList.add("overdue");

    const heading = document.createElement("h3");
    heading.textContent = task.title;
    card.appendChild(heading);

    const description = document.createElement("p");
    description.textContent = task.description || "No description provided.";
    card.appendChild(description);

    const meta = document.createElement("div");
    meta.className = "task-meta";

    addTag(meta, task.status);
    addTag(meta, `${task.priority} Priority`, task.priority.toLowerCase());
    if (task.deadline) addTag(meta, `Due: ${task.deadline}`);
    if (task.overdue) addTag(meta, "Overdue", "overdue-tag");

    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    addButton(
        actions,
        task.status === "Completed" ? "Mark Pending" : "Complete",
        "complete-button",
        () => changeStatus(
            task.id,
            task.status === "Completed" ? "Pending" : "Completed"
        )
    );

    addButton(actions, "Edit", "secondary", () => editTask(task));

    addButton(actions, "Delete", "delete-button", () => deleteTask(task.id));

    card.appendChild(actions);
    taskList.appendChild(card);
}

async function changeStatus(id, status) {
    try {
        await apiRequest(`${API}/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });
        await loadTasks();
    } catch (error) {
        alert(error.message);
    }
}

function editTask(task) {
    editingId = task.id;
    titleInput.value = task.title;
    descriptionInput.value = task.description;
    deadlineInput.value = task.deadline;
    priorityInput.value = task.priority;

    formTitle.textContent = "Edit Task";
    saveButton.textContent = "Save Changes";
    cancelButton.hidden = false;
    formError.textContent = "";

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus();
}

async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
        await apiRequest(`${API}/${id}`, { method: "DELETE" });

        if (editingId === id) resetForm();

        await loadTasks();
    } catch (error) {
        alert(error.message);
    }
}

filterInput.addEventListener("change", loadTasks);
overdueInput.addEventListener("change", loadTasks);

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTasks, 250);
});

loadTasks();
