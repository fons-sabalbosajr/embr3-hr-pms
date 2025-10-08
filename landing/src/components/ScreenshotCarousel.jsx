import React from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import dashboardImg from "../assets/dashboard.PNG";
import loginImg from "../assets/login.PNG";
import publicRequestsImg from "../assets/public_requests.PNG";
import processDTRImg from "../assets/processdtr.PNG";

const shots = [
  { src: dashboardImg, caption: "Insightful Dashboard" },
  { src: processDTRImg, caption: "Faster Time Processing" },
  { src: publicRequestsImg, caption: "Frictionless Self‑Service" },
  { src: loginImg, caption: "Secure Access, Anywhere" },
];

const ScreenshotCarousel = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: false,
    adaptiveHeight: true,
  };

  return (
    <div className="carousel-wrap container">
      <Slider {...settings}>
        {shots.map((s, i) => (
          <div key={i} className="carousel-slide">
            <img src={s.src} alt={s.caption} />
            <div className="carousel-caption">{s.caption}</div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default ScreenshotCarousel;
