import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { parseAmplifyConfig } from "aws-amplify/utils";
import outputs from "../amplify_outputs.json";
import "./style.css";

Amplify.configure({
  ...parseAmplifyConfig(outputs),
  API: { REST: outputs.custom.API },
});
type Task = {
  id: string;
  text: string;
  status: string;
  result?: string;
  owner: string;
  createdAt: string;
};
const endpoint = outputs.custom.API.tasks.endpoint;

async function request(path: string, options: RequestInit = {}) {
  const token = (await fetchAuthSession()).tokens?.accessToken?.toString();
  const response = await fetch(`${endpoint.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function Demo({ signOut }: { signOut?: () => void }) {
  const [text, setText] = useState("Amplify queue demo");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [all, setAll] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh(admin = all) {
    try {
      const data = await request(admin ? "/admin/tasks" : "/tasks");
      setTasks(
        data.tasks.sort((a: Task, b: Task) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    request("/me")
      .then((me) => setIsAdmin(me.isAdmin))
      .catch((e) => setError(e.message));
    refresh(false);
    const timer = setInterval(() => refresh(), 3000);
    return () => clearInterval(timer);
  }, [all]);
  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await request("/tasks", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setText("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header>
        <h1>Amplify REST + Queue</h1>
        <button onClick={signOut}>Đăng xuất</button>
      </header>
      <p>
        Đăng nhập qua Cognito → gọi REST API → đưa task vào SQS → Lambda xử lý →
        xem kết quả.
      </p>
      <form onSubmit={createTask}>
        <label htmlFor="task">Văn bản cần chuyển thành chữ hoa</label>
        <div className="row">
          <input
            id="task"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <button disabled={busy || !text.trim()}>Tạo task</button>
        </div>
      </form>
      {isAdmin && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => {
              setAll(e.target.checked);
              refresh(e.target.checked);
            }}
          />{" "}
          Xem task của mọi người (admin)
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <h2>Tasks</h2>
      <button onClick={() => refresh()}>Làm mới</button>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <div>
              <strong>{task.text}</strong>
              <span>{task.status}</span>
            </div>
            <small>
              {task.id}
              {all ? ` · ${task.owner}` : ""}
            </small>
            {task.result && <p>Kết quả: {task.result}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <Authenticator>{({ signOut }) => <Demo signOut={signOut} />}</Authenticator>,
);
