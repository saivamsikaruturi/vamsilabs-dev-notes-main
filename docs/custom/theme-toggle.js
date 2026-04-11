document.addEventListener("DOMContentLoaded", function () {
  var links = document.querySelectorAll("a.vtn-topic-card");
  links.forEach(function (card) {
    card.addEventListener("mouseenter", function () {
      this.style.willChange = "transform, box-shadow";
    });
    card.addEventListener("mouseleave", function () {
      this.style.willChange = "auto";
    });
  });
});
