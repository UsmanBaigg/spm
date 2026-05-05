import { Routes, Route, Navigate } from 'react-router-dom'
import UserProfilePage from '../pages/UserProfilePage'
import ServiceDetailPage from '../pages/ServiceDetailPage'
import MarketplaceItemPage from '../pages/MarketplaceItemPage'

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/users/1" replace />} />
      <Route path="/users/:id" element={<UserProfilePage />} />
      <Route path="/services/:id" element={<ServiceDetailPage />} />
      <Route path="/marketplace/:id" element={<MarketplaceItemPage />} />
      <Route path="*" element={<div className="p-6">Not Found</div>} />
    </Routes>
  )
}

export default AppRouter
