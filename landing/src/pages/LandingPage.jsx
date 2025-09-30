import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "antd";
import {
  ClockCircleOutlined,
  TeamOutlined,
  CloudOutlined,
  FacebookOutlined,
  TwitterOutlined,
  LinkedinOutlined,
  InstagramOutlined,
} from "@ant-design/icons";

import bgImage from "../assets/bgemb.webp";
import dashboardImg from "../assets/dashboard.PNG";
import loginImg from "../assets/login.PNG";
import publicRequestsImg from "../assets/public_requests.PNG";
import processDTRImg from "../assets/processDTR.PNG";
import logo from "../assets/emblogo.svg";

import starbucks from "../assets/starbucks.PNG";
import dunkin from "../assets/dunkin.PNG";
import coffeeProject from "../assets/coffeeproject.PNG";
import mccafe from "../assets/McCafe.PNG";
import timhortons from "../assets/timhortons.PNG";

import "./landingpage.css";

const stats = [
  { label: "Employees Managed", value: "1000+" },
  { label: "Attendance Accuracy", value: "up to 95%" },
  { label: "DTR Requests Processed", value: "2400+" },
  { label: "Customizable Functions", value: "up to 15+" },
];

const sections = ["hero", "features", "stats", "announcement", "cta"];

const LandingPage = () => {
  const [activeSection, setActiveSection] = useState("hero");

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
          <h1>Daily Time Record Management System</h1>
          <p>
            Modern, secure, and efficient solution to manage employee
            attendance, daily time record requests, leave applications, and
            payroll integration. Streamline HR processes with automated reports,
            real-time tracking, and easy access for both managers and employees.
          </p>
          <Button className="cta-btn" onClick={() => scrollToSection("cta")}>
            Launch App
          </Button>
        </div>
        <div className="hero-right animate-right">
          <div className="dashboard-wrapper">
            <img src={dashboardImg} alt="Dashboard" />
            <div className="dashboard-overlay"></div>
          </div>
        </div>
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

      <section id="features" className="features">
        {[
          {
            icon: <ClockCircleOutlined className="feature-icon" />,
            title: "Time Tracking",
            desc: "Accurate employee DTR tracking with real-time updates. Easily monitor attendance, late-ins, early-outs, and overtime hours. Generate automated reports for payroll and performance evaluation.",
            screenshot: processDTRImg,
            bgColor: "#1f2a45",
          },
          {
            icon: <TeamOutlined className="feature-icon" />,
            title: "Employee Access",
            desc: "Secure self-service portal for payslips, and daily time record submissions. Employees can easily view their schedules, requests, and track approvals without relying on manual forms.",
            screenshot: publicRequestsImg,
            bgColor: "#2a3f6b",
          },
          {
            icon: <CloudOutlined className="feature-icon" />,
            title: "Network based now, Cloud-Based soon...",
            desc: "Access your DTR and HR data from anywhere. Reduce paperwork and save time with digital storage. The upcoming cloud-based system ensures secure, centralized data access anytime, anywhere.",
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
        <h2>Ready to streamline your HR & DTR management?</h2>
        <Button className="cta-btn" onClick={() => scrollToSection("cta")}>
          Get Started Now
        </Button>
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
