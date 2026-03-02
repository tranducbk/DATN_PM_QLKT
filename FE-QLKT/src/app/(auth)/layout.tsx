export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/login-bg.jpg')",
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
