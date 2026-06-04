export default function PortalExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">⏰</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
        <p className="text-gray-600">
          This portal link has expired or has already been used. Please contact the sales team to request a new link.
        </p>
      </div>
    </div>
  );
}
