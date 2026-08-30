import { Route, Routes, Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Shell, ErrorBoundary } from "./components/Shell";
import { PageHead, Empty } from "./components/primitives";
import { Landing } from "./pages/Landing";
import { Launches } from "./pages/Launches";
import { LaunchDetail } from "./pages/LaunchDetail";
import { StartIndex, CreateLaunch } from "./pages/Start";
import { Desks, DeskDetail } from "./pages/Desks";
import { Portfolio } from "./pages/Portfolio";
import { Activity } from "./pages/Activity";
import { Owed } from "./pages/Owed";
import { Compare } from "./pages/Compare";
import { Private } from "./pages/Private";
import { Settings } from "./pages/Settings";

function NotFound() {
  return (
    <>
      <PageHead title="Page not found" copy="This route does not exist." />
      <Empty>
        <Link to="/launches" className="accent-text">
          Back to launches
        </Link>
      </Empty>
    </>
  );
}

function InShell({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <ErrorBoundary label="Route">{children}</ErrorBoundary>
    </Shell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ErrorBoundary label="Landing">
            <Landing />
          </ErrorBoundary>
        }
      />
      <Route path="/launches" element={<InShell><Launches /></InShell>} />
      <Route path="/raise/:sale" element={<InShell><LaunchDetail /></InShell>} />
      <Route path="/start" element={<InShell><StartIndex /></InShell>} />
      <Route path="/start/:mode" element={<InShell><CreateLaunch /></InShell>} />
      <Route path="/desks" element={<InShell><Desks /></InShell>} />
      <Route path="/desk/:slug" element={<InShell><DeskDetail /></InShell>} />
      <Route path="/portfolio" element={<InShell><Portfolio /></InShell>} />
      <Route path="/activity" element={<InShell><Activity /></InShell>} />
      <Route path="/owed" element={<InShell><Owed /></InShell>} />
      <Route path="/compare" element={<InShell><Compare /></InShell>} />
      <Route path="/private" element={<InShell><Private /></InShell>} />
      <Route path="/settings" element={<InShell><Settings /></InShell>} />
      <Route path="*" element={<InShell><NotFound /></InShell>} />
    </Routes>
  );
}
