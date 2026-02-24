import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import ArticleDetail from './pages/ArticleDetail'
import AdminDashboard from './pages/AdminDashboard'
import ArchivePage from './pages/Archive'

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Feed />} />
                    <Route path="/archive" element={<ArchivePage />} />
                    <Route path="/article/:id" element={<ArticleDetail />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                </Routes>
            </Layout>
        </Router>
    )
}

export default App
