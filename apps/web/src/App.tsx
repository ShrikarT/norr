import { Route, Routes, Link } from "react-router-dom";
import { Shell, ErrorBoundary } from "./components/Shell";
import { PageHead, Empty } from "./components/primitives";
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
        <Link to="/" className="accent-text">
          Back to launches
        </Link>
      </Empty>
    </>
  );
}

export default function App() {
  return (
    <Shell>
      <ErrorBoundary label="Route">
        <Routes>
          <Route path="/" element={<Launches />} />
          <Route path="/raise/:sale" element={<LaunchDetail />} />
          <Route path="/start" element={<StartIndex />} />
          <Route path="/start/:mode" element={<CreateLaunch />} />
          <Route path="/desks" element={<Desks />} />
          <Route path="/desk/:slug" element={<DeskDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/owed" element={<Owed />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/private" element={<Private />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </Shell>
  );
}
