import { GoogleLogin } from "@react-oauth/google";
import { config } from "../config/env";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { errorMessage } from "../api/client";
export default function GoogleAuthButton() {
  const { googleLogin } = useAuth();
  const { push } = useToast();
  if (!config.googleClientId) return null;
  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-line" />
        OR
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          width="400"
          shape="rectangular"
          theme="outline"
          onSuccess={async ({ credential }) => {
            try {
              await googleLogin(credential);
              push("Signed in with Google.");
            } catch (e) {
              push(errorMessage(e), "error");
            }
          }}
          onError={() => push("Google Sign-In did not complete.", "error")}
        />
      </div>
    </>
  );
}
