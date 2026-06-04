export default function PortalAcceptedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Accepted</h1>
        <p className="text-gray-600">
          Thank you! Your acceptance has been recorded. The sales team will be in touch shortly.
        </p>
      </div>
    </div>
  );
}
