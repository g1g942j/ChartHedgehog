package com.example.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "diagram_blocks")
public class DiagramBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diagram_id", nullable = false)
    private Diagram diagram;

    private String name;

    @Enumerated(EnumType.STRING)
    private BlockType type;

    @Column(name = "x_position")
    private Double xPosition = 0.0;

    @Column(name = "y_position")
    private Double yPosition = 0.0;

    private Double width = 100.0;
    private Double height = 80.0;
    private Integer zIndex = 0;
    private String color;
    private String content;

    public DiagramBlock() {}


    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Diagram getDiagram() { return diagram; }
    public void setDiagram(Diagram diagram) { this.diagram = diagram; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BlockType getType() { return type; }
    public void setType(BlockType type) { this.type = type; }
    public Double getXPosition() { return xPosition; }
    public void setXPosition(Double xPosition) { this.xPosition = xPosition; }
    public Double getYPosition() { return yPosition; }
    public void setYPosition(Double yPosition) { this.yPosition = yPosition; }
    public Double getWidth() { return width; }
    public void setWidth(Double width) { this.width = width; }
    public Double getHeight() { return height; }
    public void setHeight(Double height) { this.height = height; }
    public Integer getZIndex() { return zIndex; }
    public void setZIndex(Integer zIndex) { this.zIndex = zIndex; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}