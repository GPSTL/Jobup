import { BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";

import HomePage from "./pages/HomePage";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/signup" element={<ComingSoonPage />} />
				<Route path="/login" element={<ComingSoonPage />} />
				<Route path="/offers" element={<ComingSoonPage />} />
				<Route path="/companies" element={<ComingSoonPage />} />
				<Route path="/pricing" element={<ComingSoonPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
