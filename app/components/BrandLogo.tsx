import styled from "styled-components";

/**
 * Fixed top-right RobotMIA brand logo. Rendered globally on every page,
 * including public share routes. Self-hosted asset under /logos/robotmia.png.
 */
function BrandLogo() {
  return (
    <Wrapper aria-hidden>
      <img src="/logos/robotmia.png" alt="" />
    </Wrapper>
  );
}

const Wrapper = styled.div`
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 999;
  pointer-events: none;
  display: flex;
  align-items: center;

  img {
    height: 28px;
    width: auto;
    display: block;
    opacity: 0.95;
  }

  @media print {
    display: none;
  }
`;

export default BrandLogo;
