import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import {
  ClockCircleOutlined,
  TeamOutlined,
  CloudOutlined,
  FacebookOutlined,
  TwitterOutlined,
  LinkedinOutlined,
  InstagramOutlined,
} from "@ant-design/icons";

import dashboardImg from "../assets/dashboard.PNG";
import loginImg from "../assets/login.PNG";
import publicRequestsImg from "../assets/public_requests.PNG";
import processDTRImg from "../assets/processdtr.PNG";
import logo from "../assets/emblogo.svg";

import starbucks from "../assets/starbucks.PNG";
import dunkin from "../assets/dunkin.PNG";
import coffeeProject from "../assets/coffeeproject.PNG";
import mccafe from "../assets/McCafe.PNG";
import timhortons from "../assets/timhortons.PNG";

import "./landingpage.css";
import DashboardPeek from "../components/DashboardPeek.jsx";
import ScreenshotCarousel from "../components/ScreenshotCarousel.jsx";

const stats = [
  { label: "People Empowered", value: "1,000+" },
  { label: "On‑time Accuracy", value: "Up to 95%" },
  { label: "Requests Automated", value: "2,400+" },
  { label: "Configurable Features", value: "15+" },
];

const sections = ["hero", "peek", "features", "gallery", "stats", "announcement", "cta"];

const LandingPage = () => {
  const [activeSection, setActiveSection] = useState("hero");
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150; // offset for sticky navbar
      for (let id of sections) {
        const section = document.getElementById(id);
        if (section && scrollPosition >= section.offsetTop) {
          setActiveSection(id);
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 70, // offset for sticky navbar
        behavior: "smooth",
      });
    }
  };

  const goToApp = () => {
    navigate("/dtr-management-system");
  };

  return (
    <div className="landing-container">
      {/* Header / Navbar */}
      <header className="sticky-navbar">
        <div className="header-left">
          <img src={logo} alt="EMB Logo" />

          <span className="emb-title">
            DEPARMENT OF ENVIRONMENT AND NATURAL RESOURCES <br />
            ENVIRONMENTAL MANAGEMENT BUREAU CENTRAL LUZON
          </span>
        </div>
        <nav className="navbar">
          {sections.map((sec) => (
            <button
              key={sec}
              className={activeSection === sec ? "active" : ""}
              onClick={() => scrollToSection(sec)}
            >
              {sec.charAt(0).toUpperCase() + sec.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      {/* Hero Section */}
      {/* Hero Section */}
      <section id="hero" className="hero-glass">
        <div className="gradient-bg"></div>{" "}
        {/* Animated gradient behind the glass */}
        <div className="hero-left animate-left">
          <h1>Streamline Attendance. Elevate Productivity.</h1>
          <p>
            A modern HR platform that automates daily time records, approvals, and insights.
            Reduce manual work, speed up payroll, and give teams a smoother way to work.
          </p>
          <Button className="cta-btn" onClick={goToApp}>Explore the Platform</Button>
        </div>
        <div className="hero-right animate-right">
          <div className="dashboard-wrapper">
            <img src={dashboardImg} alt="Dashboard" />
            <div className="dashboard-overlay"></div>
          </div>
        </div>
      </section>

      {/* Sneak Peek Section */}
      <section id="peek" className="peek">
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>See it in action</h2>
        <p className="text-muted" style={{ textAlign: "center", marginBottom: 16 }}>Real‑time metrics and recent activity at a glance</p>
        <DashboardPeek />
      </section>

      {/* Stats Section */}
      <section id="stats" className="stats">
        {stats.map((s, idx) => (
          <div key={idx} className="stat-card">
            <h2>{s.value}</h2>
            <p>{s.label}</p>
          </div>
        ))}
      </section>

      {/* Gallery / Carousel */}
      <section id="gallery" className="gallery">
        <ScreenshotCarousel />
      </section>

      <section id="features" className="features">
        {[
          {
            icon: <ClockCircleOutlined className="feature-icon" />,
            title: "Smart Time Tracking",
            desc: "Capture attendance with precision. Monitor late-ins, early-outs, and overtime in real time—then turn data into payroll‑ready reports in a click.",
            screenshot: processDTRImg,
            bgColor: "#1f2a45",
          },
          {
            icon: <TeamOutlined className="feature-icon" />,
            title: "Self‑Service Portal",
            desc: "Give employees instant access to requests, schedules, and payslips. Fewer emails, faster approvals, happier teams.",
            screenshot: publicRequestsImg,
            bgColor: "#2a3f6b",
          },
          {
            icon: <CloudOutlined className="feature-icon" />,
            title: "Cloud‑Ready Architecture",
            desc: "Built for today—ready for tomorrow. Move from network‑based to cloud when you’re ready, with secure, centralized access anywhere.",
            screenshot: loginImg,
            bgColor: "#4b6f9a",
          },
        ].map((f, idx) => (
          <div
            key={idx}
            className={`feature-tile ${idx % 2 === 1 ? "reverse" : ""}`}
            style={{
              background: `linear-gradient(135deg, ${f.bgColor}AA, #00000033)`,
            }}
          >
            <div className="feature-text">
              {f.icon}
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
            <div className="feature-screenshot">
              <img src={f.screenshot} alt={f.title} />
              <div className="screenshot-gradient"></div>
            </div>
          </div>
        ))}
      </section>

      {/* Announcement Section */}
      <section id="announcement" className="announcement-section">
        <div className="announcement-glass">
          <div className="announcement-text">
            <h2>📢 Coming Soon!</h2>
            <p>
              <strong>November 2025</strong> — EMB R3 Daily Time Record
              Management System will officially serve the office.
            </p>
          </div>
          <div className="coffee-support">
            <h3>☕ Help me buy coffee:</h3>
            <div className="coffee-icons">
              <img src={starbucks} alt="Starbucks" title="Starbucks" />
              <img src={dunkin} alt="Dunkin" title="Dunkin" />
              <img
                src={coffeeProject}
                alt="Coffee Project"
                title="Coffee Project"
              />
              <img src={mccafe} alt="McCafe" title="McCafe" />
              <img src={timhortons} alt="Tim Hortons" title="Tim Hortons" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="cta">
            <h2>Ready to modernize attendance and HR workflows?</h2>
            <Button className="cta-btn" onClick={goToApp}>Get Started</Button>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-top">
          <div className="footer-logo">
            <img src={logo} alt="EMB Logo" />
          </div>
          <div className="footer-socials">
            <a href="#">
              <FacebookOutlined />
            </a>
            <a href="#">
              <TwitterOutlined />
            </a>
            <a href="#">
              <LinkedinOutlined />
            </a>
            <a href="#">
              <InstagramOutlined />
            </a>
          </div>
        </div>
        <p>© 2025 EMB R3 DTR Management System. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
