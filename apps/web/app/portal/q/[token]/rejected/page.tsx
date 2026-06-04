export default function PortalRejectedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Rejected</h1>
        <p className="text-gray-600">
          Your rejection has been recorded. The sales team will review your feedback and may reach out with a revised offer.
        </p>
      </div>
    </div>
  );
}
