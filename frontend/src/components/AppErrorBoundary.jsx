import { Component } from "react";
import { clearAppCaches } from "../utils/cache";
import { clearAppLocalStorage } from "../utils/storage";
import ErrorBanner from "./ErrorBanner";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, details: null };
  }

  static getDerivedStateFromError(error) {
    return {
      error: error || new Error("Unknown error"),
      details: error?.stack || null,
    };
  }

  componentDidCatch() {}

  async handleResetSession() {
    try {
      await clearAppCaches();
    } catch {}
    clearAppLocalStorage();
    window.location.reload();
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "#050816",
            color: "#f9fafb",
          }}
        >
          <h1 style={{ marginBottom: "0.5rem" }}>Quick LLM</h1>
          <ErrorBanner
            title="Something went wrong"
            message="The app hit an unexpected error. You can reload or reset the session."
            details={this.state.details}
            actions={[
              { label: "Reload page", onClick: () => window.location.reload() },
              {
                label: "Reset session",
                onClick: () => this.handleResetSession(),
              },
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
