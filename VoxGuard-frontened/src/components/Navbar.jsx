import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  X,
  Shield,
} from "lucide-react";

export default function Navbar({ onProfileClick, onLogout }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settingsRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  /* ==========================================
     LIGHT / DARK MODE
  ========================================== */

  const [lightMode, setLightMode] = useState(
    () => localStorage.getItem("voxguard-theme") === "light"
  );

  /* ==========================================
     APPLY THEME
  ========================================== */

  useEffect(() => {
    document.documentElement.dataset.theme = lightMode
      ? "light"
      : "dark";

    localStorage.setItem(
      "voxguard-theme",
      lightMode ? "light" : "dark"
    );
  }, [lightMode]);

  /* ==========================================
     CLOSE SETTINGS WHEN CLICKING OUTSIDE
  ========================================== */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target)
      ) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* ==========================================
     CLOSE MOBILE MENU ON ROUTE CHANGE
  ========================================== */

  useEffect(() => {
    setOpen(false);
    setSettingsOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [location.pathname]);

  /* ==========================================
     HELPERS
  ========================================== */

  const closeMobileMenu = () => {
    setOpen(false);
  };

  /* ==========================================
     ACTIVE PAGE
  ========================================== */

  const isActive = (path) => {
    /*
      HOME
      Only active when URL is exactly "/"
    */
    if (path === "/") {
      return location.pathname === "/";
    }

    /*
      OTHER PAGES
      Active when pathname starts with the route.
    */
    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  /* ==========================================
     NAVIGATION HANDLER
  ========================================== */

  const handleNavigation = () => {
    closeMobileMenu();
    setSettingsOpen(false);
  };

  /* ==========================================
     LOGO → HOME
  ========================================== */

  const handleLogoClick = () => {
    closeMobileMenu();
    setSettingsOpen(false);

    navigate("/");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* ==========================================
     PROFILE
  ========================================== */

  const handleProfile = () => {
    closeMobileMenu();
    setSettingsOpen(false);

    onProfileClick?.();
  };

  /* ==========================================
     SECURITY
  ========================================== */

  const handleSecurity = () => {
    closeMobileMenu();
    setSettingsOpen(false);

    /*
      If you have a dedicated security route,
      change this to:

      navigate("/security");
    */

    navigate("/security");
  };

  /* ==========================================
     LOGOUT
  ========================================== */

  const handleLogout = () => {
    setSettingsOpen(false);
    closeMobileMenu();

    if (onLogout) {
      onLogout();
      return;
    }

    localStorage.removeItem("voxguard_access_token");

    window.location.reload();
  };

  /* ==========================================
     THEME
  ========================================== */

  const toggleTheme = () => {
    setLightMode((current) => !current);
  };

  return (
    <header
      className="
        sticky
        top-0
        z-50
        border-b
        border-slate-800/70
        bg-[#080c14]/90
        backdrop-blur-xl
      "
    >
      {/* =================================================
          MAIN NAVBAR
      ================================================== */}

      <div className="flex w-full items-center px-6 py-3">

        {/* =================================================
            LOGO — LEFT
        ================================================== */}

        <button
          type="button"
          onClick={handleLogoClick}
          className="
            group
            flex
            shrink-0
            items-center
            gap-2.5
          "
        >
          {/* LOGO ICON */}

          <span
            className="
              grid
              h-9
              w-9
              place-items-center
              rounded-lg
              bg-gradient-to-br
              from-cyan-400
              to-indigo-500
              text-slate-950
              shadow-md
              shadow-cyan-500/20
              transition
              group-hover:scale-105
            "
          >
            <ShieldCheck
              size={21}
              strokeWidth={2.4}
            />
          </span>

          {/* BRAND NAME */}

          <span
            className="
              text-[20px]
              font-extrabold
              tracking-tight
              text-white
            "
          >
            Swaraksha
          </span>
        </button>

        {/* =================================================
            DESKTOP NAVIGATION — RIGHT
        ================================================== */}

        <nav
          className="
            ml-auto
            hidden
            flex-1
            items-center
            justify-end
            gap-6
            md:flex
          "
        >

          {/* =================================================
              HOME
          ================================================== */}

          <Link
            to="/"
            onClick={handleNavigation}
            className={`
              relative
              px-1
              py-2
              text-[15px]
              font-medium
              transition-colors
              duration-200

              ${
                isActive("/")
                  ? "text-cyan-400"
                  : "text-slate-300 hover:text-cyan-400"
              }
            `}
          >
            Home

            {/* ACTIVE BAR */}

            {isActive("/") && (
              <span
                className="
                  absolute
                  -bottom-[13px]
                  left-0
                  h-[3px]
                  w-full
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_8px_rgba(34,211,238,0.7)]
                "
              />
            )}
          </Link>

          {/* =================================================
              ABOUT US
          ================================================== */}

          <Link
            to="/about"
            onClick={handleNavigation}
            className={`
              relative
              px-1
              py-2
              text-[15px]
              font-medium
              transition-colors
              duration-200

              ${
                isActive("/about")
                  ? "text-cyan-400"
                  : "text-slate-300 hover:text-cyan-400"
              }
            `}
          >
            About Us

            {/* ACTIVE BAR */}

            {isActive("/about") && (
              <span
                className="
                  absolute
                  -bottom-[13px]
                  left-0
                  h-[3px]
                  w-full
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_8px_rgba(34,211,238,0.7)]
                "
              />
            )}
          </Link>

          {/* =================================================
              BLOG
          ================================================== */}

          <Link
            to="/blog"
            onClick={handleNavigation}
            className={`
              relative
              px-1
              py-2
              text-[15px]
              font-medium
              transition-colors
              duration-200

              ${
                isActive("/blog")
                  ? "text-cyan-400"
                  : "text-slate-300 hover:text-cyan-400"
              }
            `}
          >
            Blog

            {/* ACTIVE BAR */}

            {isActive("/blog") && (
              <span
                className="
                  absolute
                  -bottom-[13px]
                  left-0
                  h-[3px]
                  w-full
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_8px_rgba(34,211,238,0.7)]
                "
              />
            )}
          </Link>

          {/* =================================================
              LIVE DEMO
          ================================================== */}

          <Link
            to="/live-demo"
            onClick={handleNavigation}
            className="
              relative
              rounded-lg
              bg-gradient-to-r
              from-cyan-400
              to-indigo-400
              px-4
              py-3
              text-[15px]
              font-bold
              text-slate-950
              shadow-md
              shadow-cyan-500/15
              transition
              duration-200
              hover:-translate-y-0.5
              hover:shadow-lg
              hover:shadow-cyan-400/25
            "
          >
            Live Demo

            {/* ACTIVE BAR */}

            {isActive("/live-demo") && (
              <span
                className="
                  absolute
                  -bottom-[13px]
                  left-0
                  h-[3px]
                  w-full
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_8px_rgba(34,211,238,0.7)]
                "
              />
            )}
          </Link>

          {/* =================================================
              SETTINGS
          ================================================== */}

          <div
            ref={settingsRef}
            className="relative shrink-0"
          >
            {/* SETTINGS BUTTON */}

            <button
              type="button"
              onClick={() =>
                setSettingsOpen(
                  (current) => !current
                )
              }
              className={`
                relative
                flex
                items-center
                gap-1.5
                px-1
                py-2
                text-[16px]
                font-medium
                transition-colors
                duration-200

                ${
                  settingsOpen ||
                  isActive("/settings")
                    ? "text-cyan-400"
                    : "text-slate-300 hover:text-cyan-400"
                }
              `}
            >
              <Settings
                size={16}
                className={
                  settingsOpen
                    ? "rotate-45 transition-transform"
                    : "transition-transform"
                }
              />

              Settings

              <ChevronDown
                size={16}
                className={`
                  transition-transform
                  ${
                    settingsOpen
                      ? "rotate-180"
                      : ""
                  }
                `}
              />

              {/* ACTIVE BAR FOR SETTINGS */}

              {isActive("/settings") && (
                <span
                  className="
                    absolute
                    -bottom-[13px]
                    left-0
                    h-[3px]
                    w-full
                    rounded-full
                    bg-cyan-400
                    shadow-[0_0_8px_rgba(34,211,238,0.7)]
                  "
                />
              )}
            </button>

            {/* =================================================
                SETTINGS DROPDOWN
            ================================================== */}

            {settingsOpen && (
              <div
                className="
                  absolute
                  right-0
                  top-[calc(100%+14px)]
                  w-60
                  overflow-hidden
                  rounded-xl
                  border
                  border-slate-700/80
                  bg-[#0d1320]
                  p-2
                  shadow-2xl
                  shadow-black/40
                "
              >

                {/* DROPDOWN HEADER */}

                <div
                  className="
                    border-b
                    border-slate-800
                    px-3
                    py-2.5
                  "
                >
                  <p className="text-sm font-bold text-white">
                    Settings
                  </p>

                  <p className="mt-0.5 text-[13px] text-slate-500">
                    Manage your Swaraksha preferences
                  </p>
                </div>

                {/* =================================================
                    PROFILE
                ================================================== */}

                <button
                  type="button"
                  onClick={handleProfile}
                  className="
                    mt-1
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    transition
                    hover:bg-slate-800/70
                  "
                >
                  <span
                    className="
                      grid
                      h-8
                      w-8
                      place-items-center
                      rounded-lg
                      bg-cyan-400/10
                      text-cyan-400
                    "
                  >
                    <UserRound size={15} />
                  </span>

                  <span>
                    <span
                      className="
                        block
                        text-sm
                        font-semibold
                        text-slate-200
                      "
                    >
                      Profile
                    </span>

                    <span
                      className="
                        block
                        text-[13px]
                        text-slate-500
                      "
                    >
                      View your voice records
                    </span>
                  </span>
                </button>

                {/* =================================================
                    SECURITY
                ================================================== */}

                <button
                  type="button"
                  onClick={handleSecurity}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    transition
                    hover:bg-slate-800/70
                  "
                >
                  <span
                    className="
                      grid
                      h-8
                      w-8
                      place-items-center
                      rounded-lg
                      bg-indigo-400/10
                      text-indigo-400
                    "
                  >
                    <Shield size={15} />
                  </span>

                  <span>
                    <span
                      className="
                        block
                        text-sm
                        font-semibold
                        text-slate-200
                      "
                    >
                      Security
                    </span>

                    <span
                      className="
                        block
                        text-[13px]
                        text-slate-500
                    "
                    >
                      Privacy & protection
                    </span>
                  </span>
                </button>

                {/* =================================================
                    THEME
                ================================================== */}

                <div
                  className="
                    my-1
                    border-t
                    border-slate-800
                  "
                />

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="
                    flex
                    w-full
                    items-center
                    justify-between
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    transition
                    hover:bg-slate-800/70
                  "
                >
                  <div className="flex items-center gap-3">

                    <span
                      className="
                        grid
                        h-8
                        w-8
                        place-items-center
                        rounded-lg
                        bg-slate-800
                        text-slate-300
                      "
                    >
                      {lightMode ? (
                        <Moon size={15} />
                      ) : (
                        <Sun size={15} />
                      )}
                    </span>

                    <span>
                      <span
                        className="
                          block
                          text-sm
                          font-semibold
                          text-slate-200
                        "
                      >
                        Appearance
                      </span>

                      <span
                        className="
                          block
                          text-[13px]
                          text-slate-500
                        "
                      >
                        {lightMode
                          ? "Light mode"
                          : "Dark mode"}
                      </span>
                    </span>

                  </div>

                  {/* TOGGLE */}

                  <span
                    className={`
                      relative
                      h-5
                      w-9
                      rounded-full
                      transition

                      ${
                        lightMode
                          ? "bg-cyan-400"
                          : "bg-slate-700"
                      }
                    `}
                  >
                    <span
                      className={`
                        absolute
                        top-0.5
                        h-4
                        w-4
                        rounded-full
                        bg-white
                        shadow
                        transition-transform

                        ${
                          lightMode
                            ? "translate-x-4"
                            : "translate-x-0.5"
                        }
                      `}
                    />
                  </span>
                </button>

                {/* =================================================
                    LOGOUT
                ================================================== */}

                <div
                  className="
                    my-1
                    border-t
                    border-slate-800
                  "
                />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    transition
                    hover:bg-rose-500/10
                  "
                >
                  <span
                    className="
                      grid
                      h-8
                      w-8
                      place-items-center
                      rounded-lg
                      bg-rose-500/10
                      text-rose-400
                    "
                  >
                    <LogOut size={15} />
                  </span>

                  <span>
                    <span
                      className="
                        block
                        text-sm
                        font-semibold
                        text-rose-300
                      "
                    >
                      Logout
                    </span>

                    <span
                      className="
                        block
                        text-[13px]
                        text-slate-500
                      "
                    >
                      Sign out of your account
                    </span>
                  </span>
                </button>

              </div>
            )}
          </div>

        </nav>

        {/* =================================================
            MOBILE MENU BUTTON
        ================================================== */}

        <button
          type="button"
          onClick={() =>
            setOpen((current) => !current)
          }
          className="
            ml-auto
            grid
            h-9
            w-9
            shrink-0
            place-items-center
            rounded-lg
            border
            border-slate-700
            bg-slate-900/70
            text-slate-300
            md:hidden
          "
        >
          {open ? (
            <X size={19} />
          ) : (
            <Menu size={19} />
          )}
        </button>

      </div>

      {/* =====================================================
          MOBILE NAVIGATION
      ====================================================== */}

      {open && (
        <div
          className="
            border-t
            border-slate-800/70
            bg-[#080c14]/95
            px-5
            py-4
            md:hidden
          "
        >

          <nav className="flex flex-col gap-1">

            {/* HOME */}

            <Link
              to="/"
              onClick={handleNavigation}
              className={`
                relative
                rounded-lg
                px-3
                py-2.5
                text-[15px]
                font-medium

                ${
                  isActive("/")
                    ? "bg-slate-800/60 text-cyan-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                }
              `}
            >
              Home

              {isActive("/") && (
                <span
                  className="
                    absolute
                    bottom-1
                    left-3
                    h-[2px]
                    w-10
                    rounded-full
                    bg-cyan-400
                  "
                />
              )}
            </Link>

            {/* ABOUT US */}

            <Link
              to="/about"
              onClick={handleNavigation}
              className={`
                relative
                rounded-lg
                px-3
                py-2.5
                text-[15px]
                font-medium

                ${
                  isActive("/about")
                    ? "bg-slate-800/60 text-cyan-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                }
              `}
            >
              About Us

              {isActive("/about") && (
                <span
                  className="
                    absolute
                    bottom-1
                    left-3
                    h-[2px]
                    w-16
                    rounded-full
                    bg-cyan-400
                  "
                />
              )}
            </Link>

            {/* BLOG */}

            <Link
              to="/blog"
              onClick={handleNavigation}
              className={`
                relative
                rounded-lg
                px-3
                py-2.5
                text-[15px]
                font-medium

                ${
                  isActive("/blog")
                    ? "bg-slate-800/60 text-cyan-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                }
              `}
            >
              Blog

              {isActive("/blog") && (
                <span
                  className="
                    absolute
                    bottom-1
                    left-3
                    h-[2px]
                    w-8
                    rounded-full
                    bg-cyan-400
                  "
                />
              )}
            </Link>

            {/* LIVE DEMO */}

            <Link
              to="/live-demo"
              onClick={handleNavigation}
              className="
                relative
                mt-1
                rounded-lg
                bg-gradient-to-r
                from-cyan-400
                to-indigo-400
                px-3
                py-2.5
                text-center
                text-[15px]
                font-bold
                text-slate-950
              "
            >
              Live Demo

              {isActive("/live-demo") && (
                <span
                  className="
                    absolute
                    bottom-1
                    left-1/2
                    h-[2px]
                    w-16
                    -translate-x-1/2
                    rounded-full
                    bg-slate-950
                  "
                />
              )}
            </Link>

            {/* =================================================
                MOBILE SETTINGS
            ================================================== */}

            <button
              type="button"
              onClick={() =>
                setSettingsOpen(
                  (current) => !current
                )
              }
              className={`
                mt-1
                flex
                items-center
                justify-between
                rounded-lg
                px-3
                py-2.5
                text-[15px]
                font-medium

                ${
                  settingsOpen ||
                  isActive("/settings")
                    ? "bg-slate-800/60 text-cyan-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                }
              `}
            >
              <span className="flex items-center gap-2">
                <Settings size={16} />
                Settings
              </span>

              <ChevronDown
                size={15}
                className={`
                  transition

                  ${
                    settingsOpen
                      ? "rotate-180"
                      : ""
                  }
                `}
              />
            </button>

            {/* MOBILE SETTINGS CONTENT */}

            {settingsOpen && (
              <div
                className="
                  ml-3
                  rounded-lg
                  border
                  border-slate-800
                  bg-slate-900/70
                  p-2
                "
              >

                {/* PROFILE */}

                <button
                  type="button"
                  onClick={handleProfile}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2
                    rounded-lg
                    px-3
                    py-2.5
                    text-[13px]
                    text-slate-300
                    hover:bg-slate-800
                  "
                >
                  <UserRound size={15} />
                  Profile
                </button>

                {/* SECURITY */}

                <button
                  type="button"
                  onClick={handleSecurity}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2
                    rounded-lg
                    px-3
                    py-2.5
                    text-[13px]
                    text-slate-300
                    hover:bg-slate-800
                  "
                >
                  <Shield size={15} />
                  Security
                </button>

                {/* THEME */}

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2
                    rounded-lg
                    px-3
                    py-2.5
                    text-[13px]
                    text-slate-300
                    hover:bg-slate-800
                  "
                >
                  {lightMode ? (
                    <Moon size={15} />
                  ) : (
                    <Sun size={15} />
                  )}

                  {lightMode
                    ? "Switch to Dark Mode"
                    : "Switch to Light Mode"}
                </button>

                {/* LOGOUT */}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2
                    rounded-lg
                    px-3
                    py-2.5
                    text-[13px]
                    text-rose-300
                    hover:bg-rose-500/10
                  "
                >
                  <LogOut size={15} />
                  Logout
                </button>

              </div>
            )}

          </nav>

        </div>
      )}

    </header>
  );
}