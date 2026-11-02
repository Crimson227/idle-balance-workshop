(function(){
 'use strict';
 if(typeof IntersectionObserver==='undefined')return;
 const links=[...document.querySelectorAll('.section-nav a[href^="#"]')];
 const sections=links.map(link=>({link,section:document.getElementById(link.getAttribute('href').slice(1))})).filter(x=>x.section);
 const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(!visible)return;for(const item of sections){if(item.section===visible.target)item.link.setAttribute('aria-current','location');else item.link.removeAttribute('aria-current');}},{rootMargin:'-12% 0px -65% 0px',threshold:0});
 for(const item of sections)observer.observe(item.section);
})();
