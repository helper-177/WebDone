document.addEventListener('DOMContentLoaded', () => {
  // Тема
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) document.body.classList.add('dark');

  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });

  // Меню
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.querySelector('.menu').classList.toggle('show');
  });

  // Анимации
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate').forEach(el => observer.observe(el));
});
